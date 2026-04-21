import { Types } from 'mongoose';
import type { TimetableOccurrenceDto } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Course,
  Enrollment,
  TimetableOverride,
  User,
  type HydratedTimetableEntry,
  type HydratedTimetableOverride,
} from '../models/index.js';
import { listHolidaysByIstDates } from './holidayService.js';
import { listEntriesByBatch } from './timetableEntryService.js';
import {
  istDateStringFromUtc,
  istDayOfWeek,
  istDayRange,
  istWallClockIso,
  nowUtc,
  utcDateForIstDay,
} from './timetableTz.js';

export interface ResolveWindowInput {
  batchId: Types.ObjectId;
  fromIstYmd: string;
  toIstYmd: string;
}

function assertIstDate(ymd: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Date must be YYYY-MM-DD (IST calendar day), got: ${ymd}`,
    );
  }
}

function toOccurrenceIso(istYmd: string, minutes: number): string {
  return istWallClockIso(istYmd, minutes);
}

export async function resolveWindow(
  input: ResolveWindowInput,
): Promise<TimetableOccurrenceDto[]> {
  assertIstDate(input.fromIstYmd);
  assertIstDate(input.toIstYmd);
  if (input.fromIstYmd > input.toIstYmd) {
    throw new HttpError(400, 'INVALID_DATE_WINDOW', 'from must be on or before to.');
  }
  const fromMs = utcDateForIstDay(input.fromIstYmd).getTime();
  const toMs = utcDateForIstDay(input.toIstYmd).getTime();
  const days = Math.round((toMs - fromMs) / 86_400_000) + 1;
  if (days > 90) {
    throw new HttpError(
      400,
      'INVALID_DATE_WINDOW',
      'Timetable windows are limited to 90 days.',
    );
  }

  const [entries, overrides, days_] = await Promise.all([
    listEntriesByBatch(input.batchId),
    TimetableOverride.find({
      batchId: input.batchId,
      date: {
        $gte: utcDateForIstDay(input.fromIstYmd),
        $lte: new Date(utcDateForIstDay(input.toIstYmd).getTime() + 86_399_999),
      },
    }),
    Promise.resolve(istDayRange(input.fromIstYmd, input.toIstYmd)),
  ]);

  const holidaySet = await listHolidaysByIstDates(days_);

  // Batch-hydrate course + faculty names to avoid N+1.
  const courseIds = new Set<string>();
  const userIds = new Set<string>();
  entries.forEach((e) => {
    courseIds.add(e.courseId.toString());
    userIds.add(e.facultyId.toString());
  });
  overrides.forEach((o) => {
    if (o.newCourseId) courseIds.add(o.newCourseId.toString());
    if (o.newFacultyId) userIds.add(o.newFacultyId.toString());
  });
  const [courses, users] = await Promise.all([
    Course.find({ _id: { $in: Array.from(courseIds) } }).select('name'),
    User.find({ _id: { $in: Array.from(userIds) } }).select('name'),
  ]);
  const courseNameById = new Map<string, string>();
  courses.forEach((c) => courseNameById.set(c._id.toString(), c.name));
  const userNameById = new Map<string, string>();
  users.forEach((u) => userNameById.set(u._id.toString(), u.name));

  // Bucket overrides by IST date.
  const overridesByDate = new Map<string, HydratedTimetableOverride[]>();
  overrides.forEach((o) => {
    const istYmd = istDateStringFromUtc(o.date);
    const list = overridesByDate.get(istYmd) ?? [];
    list.push(o);
    overridesByDate.set(istYmd, list);
  });

  const occurrences: TimetableOccurrenceDto[] = [];

  for (const istYmd of days_) {
    if (holidaySet.has(istYmd)) {
      // Holiday drops the whole IST day — even reschedules & adds.
    } else {
      const dayDoW = istDayOfWeek(utcDateForIstDay(istYmd));
      const overridesForDay = overridesByDate.get(istYmd) ?? [];
      const overrideByEntry = new Map<string, HydratedTimetableOverride>();
      overridesForDay.forEach((o) => {
        if (o.entryId) overrideByEntry.set(o.entryId.toString(), o);
      });

      // Recurring entries on this day-of-week, minus cancellations.
      entries
        .filter((entry) => entry.dayOfWeek === dayDoW)
        .forEach((entry) => {
          const override = overrideByEntry.get(entry._id.toString());
          if (override?.action === 'cancel') return;
          occurrences.push(
            renderOccurrence(
              istYmd,
              entry,
              override?.action === 'reschedule' ? override : null,
              courseNameById,
              userNameById,
            ),
          );
        });

      // Extra 'add' occurrences (no entryId).
      overridesForDay
        .filter((o) => o.action === 'add')
        .forEach((o) => {
          occurrences.push(renderAdded(istYmd, o, courseNameById, userNameById));
        });
    }
  }

  occurrences.sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0));
  return occurrences;
}

function renderOccurrence(
  istYmd: string,
  entry: HydratedTimetableEntry,
  reschedule: HydratedTimetableOverride | null,
  courseNameById: Map<string, string>,
  userNameById: Map<string, string>,
): TimetableOccurrenceDto {
  const courseId = reschedule?.newCourseId ?? entry.courseId;
  const facultyId = reschedule?.newFacultyId ?? entry.facultyId;
  const startMin = reschedule?.newStartMinutes ?? entry.startTimeMinutes;
  const endMin = reschedule?.newEndMinutes ?? entry.endTimeMinutes;
  const room = reschedule?.newRoom ?? entry.room;

  return {
    entryId: entry._id.toString(),
    overrideId: reschedule?._id.toString() ?? null,
    batchId: entry.batchId.toString(),
    courseId: courseId.toString(),
    courseName: courseNameById.get(courseId.toString()) ?? '',
    facultyId: facultyId.toString(),
    facultyName: userNameById.get(facultyId.toString()) ?? '',
    date: istYmd,
    startAt: toOccurrenceIso(istYmd, startMin),
    endAt: toOccurrenceIso(istYmd, endMin),
    room: room ?? '',
    notes: entry.notes ?? '',
    isOverride: Boolean(reschedule),
    isAdded: false,
  };
}

function renderAdded(
  istYmd: string,
  override: HydratedTimetableOverride,
  courseNameById: Map<string, string>,
  userNameById: Map<string, string>,
): TimetableOccurrenceDto {
  const courseId = override.newCourseId!;
  const facultyId = override.newFacultyId!;
  return {
    entryId: null,
    overrideId: override._id.toString(),
    batchId: override.batchId.toString(),
    courseId: courseId.toString(),
    courseName: courseNameById.get(courseId.toString()) ?? '',
    facultyId: facultyId.toString(),
    facultyName: userNameById.get(facultyId.toString()) ?? '',
    date: istYmd,
    startAt: toOccurrenceIso(istYmd, override.newStartMinutes!),
    endAt: toOccurrenceIso(istYmd, override.newEndMinutes!),
    room: override.newRoom ?? '',
    notes: override.reason ?? '',
    isOverride: true,
    isAdded: true,
  };
}

/**
 * Returns the chronologically-next upcoming class for this student, or null
 * if no active enrolment or no class in the next 14 IST days. Used by the
 * student dashboard `nextClass` bucket.
 */
export async function getNextClassForStudent(
  studentId: Types.ObjectId,
  now: Date = nowUtc(),
): Promise<TimetableOccurrenceDto | null> {
  const activeEnrolments = await Enrollment.find({
    studentId,
    status: 'active',
  });
  if (activeEnrolments.length === 0) return null;
  const batchIds = Array.from(
    new Set(activeEnrolments.map((e) => e.batchId.toString())),
  ).map((id) => new Types.ObjectId(id));
  if (batchIds.length === 0) return null;

  const fromIst = istDateStringFromUtc(now);
  const toUtc = new Date(now.getTime() + 14 * 86_400_000);
  const toIst = istDateStringFromUtc(toUtc);

  const windowResults = await Promise.all(
    batchIds.map((batchId) =>
      resolveWindow({ batchId, fromIstYmd: fromIst, toIstYmd: toIst }),
    ),
  );
  const resolved: TimetableOccurrenceDto[] = windowResults.flat();

  const nowIso = formatAsIstIso(now);
  const upcoming = resolved
    .filter((o) => o.startAt >= nowIso)
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
  return upcoming[0] ?? null;
}

function formatAsIstIso(d: Date): string {
  // Produce an ISO string in IST wall-clock with +05:30 suffix for
  // lexicographic comparison with occurrence.startAt values.
  const istMs = d.getTime() + 330 * 60_000;
  const iso = new Date(istMs).toISOString();
  return `${iso.slice(0, 19)}+05:30`;
}
