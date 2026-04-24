import { Types } from 'mongoose';
import type {
  CreateTimetableEntryInput,
  Role,
  TimetableEntryDto,
  UpdateTimetableEntryInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  Course,
  TimetableEntry,
  User,
  type HydratedTimetableEntry,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { facultyAssignedToCourse, findCourseById } from './courseService.js';
import type { ActorContext } from './userService.js';

function requireId(id: string, label = 'Timetable entry'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Only admins may ${verb} timetable entries.`,
    );
  }
}

export function toTimetableEntryDto(
  doc: HydratedTimetableEntry,
): TimetableEntryDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id: String(json.id),
    batchId: doc.batchId.toString(),
    courseId: doc.courseId.toString(),
    facultyId: doc.facultyId.toString(),
    dayOfWeek: doc.dayOfWeek,
    startTimeMinutes: doc.startTimeMinutes,
    endTimeMinutes: doc.endTimeMinutes,
    room: doc.room ?? '',
    notes: doc.notes ?? '',
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
  };
}

export interface EntryShape {
  batchId: Types.ObjectId;
  facultyId: Types.ObjectId;
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  room: string;
}

export async function assertNoOverlap(
  candidate: EntryShape,
  excludeEntryId: Types.ObjectId | null = null,
): Promise<void> {
  const base: Record<string, unknown> = {
    deletedAt: null,
    dayOfWeek: candidate.dayOfWeek,
    startTimeMinutes: { $lt: candidate.endTimeMinutes },
    endTimeMinutes: { $gt: candidate.startTimeMinutes },
  };
  if (excludeEntryId) base._id = { $ne: excludeEntryId };

  const orClauses: Record<string, unknown>[] = [
    { batchId: candidate.batchId },
    { facultyId: candidate.facultyId },
  ];
  const trimmedRoom = candidate.room.trim();
  if (trimmedRoom !== '') {
    orClauses.push({ room: trimmedRoom });
  }

  const clash = await TimetableEntry.findOne({ ...base, $or: orClauses });
  if (!clash) return;

  let kind: 'batch' | 'faculty' | 'room' = 'batch';
  if (clash.batchId.equals(candidate.batchId)) kind = 'batch';
  else if (clash.facultyId.equals(candidate.facultyId)) kind = 'faculty';
  else kind = 'room';

  throw new HttpError(409, 'TIMETABLE_OVERLAP', 'Timetable entry overlaps an existing one.', {
    conflictId: clash._id.toString(),
    kind,
  });
}

async function assertFacultyResolves(
  facultyId: Types.ObjectId,
  courseId: Types.ObjectId,
): Promise<void> {
  const [user, course] = await Promise.all([
    User.findOne({ _id: facultyId, role: 'faculty', deletedAt: null }),
    findCourseById(courseId.toString()),
  ]);
  if (!user) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'facultyId must reference an active faculty user.');
  }
  if (!course) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  if (!facultyAssignedToCourse(course, facultyId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Faculty is not assigned to this course. Assign via Course.facultyIds first.',
    );
  }
}

function assertTimeRange(start: number, end: number): void {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new HttpError(400, 'INVALID_TIME_RANGE', 'Start/end must be integer minutes from midnight.');
  }
  if (start < 0 || start > 1439 || end < 1 || end > 1440 || end <= start) {
    throw new HttpError(
      400,
      'INVALID_TIME_RANGE',
      'End time must be strictly greater than start time within [0, 1440].',
    );
  }
}

function assertDayOfWeek(d: number): void {
  if (!Number.isInteger(d) || d < 0 || d > 6) {
    throw new HttpError(
      400,
      'INVALID_TIME_RANGE',
      'dayOfWeek must be an integer 0..6 (Sun..Sat).',
    );
  }
}

export async function listEntriesByBatch(
  batchId: Types.ObjectId,
): Promise<HydratedTimetableEntry[]> {
  return TimetableEntry.find({ batchId, deletedAt: null }).sort({
    dayOfWeek: 1,
    startTimeMinutes: 1,
  });
}

export async function listEntriesByFaculty(
  facultyId: Types.ObjectId,
): Promise<HydratedTimetableEntry[]> {
  return TimetableEntry.find({ facultyId, deletedAt: null }).sort({
    dayOfWeek: 1,
    startTimeMinutes: 1,
  });
}

export async function findEntryById(
  id: string,
): Promise<HydratedTimetableEntry | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return TimetableEntry.findOne({ _id: id, deletedAt: null });
}

export async function createEntry(
  batchIdString: string,
  input: CreateTimetableEntryInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableEntry> {
  assertAdmin(actor.role, 'create');
  const batchId = requireId(batchIdString, 'Batch');
  const courseId = requireId(input.courseId, 'Course');
  const facultyId = requireId(input.facultyId, 'Faculty');

  const batch = await Batch.findOne({ _id: batchId, deletedAt: null });
  if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  const course = await Course.findOne({ _id: courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (!course.programId.equals(batch.programId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Course does not belong to the batch\'s program.',
    );
  }

  assertDayOfWeek(input.dayOfWeek);
  assertTimeRange(input.startTimeMinutes, input.endTimeMinutes);

  await assertFacultyResolves(facultyId, courseId);

  await assertNoOverlap(
    {
      batchId,
      facultyId,
      dayOfWeek: input.dayOfWeek,
      startTimeMinutes: input.startTimeMinutes,
      endTimeMinutes: input.endTimeMinutes,
      room: input.room ?? '',
    },
    null,
  );

  const doc = await TimetableEntry.create({
    batchId,
    courseId,
    facultyId,
    dayOfWeek: input.dayOfWeek,
    startTimeMinutes: input.startTimeMinutes,
    endTimeMinutes: input.endTimeMinutes,
    room: (input.room ?? '').trim(),
    notes: input.notes ?? '',
  });

  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.entry.created',
    targetType: 'TimetableEntry',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });

  return doc;
}

export async function updateEntry(
  entryIdString: string,
  patch: UpdateTimetableEntryInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableEntry> {
  assertAdmin(actor.role, 'update');
  const entryId = requireId(entryIdString);
  const doc = await TimetableEntry.findOne({ _id: entryId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Timetable entry not found.');
  const before = doc.toObject();

  if (patch.courseId !== undefined) {
    const courseId = requireId(patch.courseId, 'Course');
    const course = await Course.findOne({ _id: courseId, deletedAt: null });
    if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
    const batch = await Batch.findOne({ _id: doc.batchId, deletedAt: null });
    if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
    if (!course.programId.equals(batch.programId)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'Course does not belong to the batch\'s program.',
      );
    }
    doc.courseId = courseId;
  }
  if (patch.facultyId !== undefined) {
    doc.facultyId = requireId(patch.facultyId, 'Faculty');
  }
  if (patch.dayOfWeek !== undefined) {
    assertDayOfWeek(patch.dayOfWeek);
    doc.dayOfWeek = patch.dayOfWeek;
  }
  if (patch.startTimeMinutes !== undefined) {
    doc.startTimeMinutes = patch.startTimeMinutes;
  }
  if (patch.endTimeMinutes !== undefined) {
    doc.endTimeMinutes = patch.endTimeMinutes;
  }
  assertTimeRange(doc.startTimeMinutes, doc.endTimeMinutes);

  if (patch.room !== undefined) doc.room = patch.room.trim();
  if (patch.notes !== undefined) doc.notes = patch.notes;

  // Re-validate faculty assignment against (possibly new) course.
  await assertFacultyResolves(doc.facultyId, doc.courseId);

  await assertNoOverlap(
    {
      batchId: doc.batchId,
      facultyId: doc.facultyId,
      dayOfWeek: doc.dayOfWeek,
      startTimeMinutes: doc.startTimeMinutes,
      endTimeMinutes: doc.endTimeMinutes,
      room: doc.room,
    },
    doc._id,
  );

  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.entry.updated',
    targetType: 'TimetableEntry',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteEntry(
  entryIdString: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableEntry> {
  assertAdmin(actor.role, 'delete');
  const entryId = requireId(entryIdString);
  const doc = await TimetableEntry.findOne({ _id: entryId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Timetable entry not found.');
  const before = doc.toObject();
  doc.deletedAt = new Date();
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.entry.deleted',
    targetType: 'TimetableEntry',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
