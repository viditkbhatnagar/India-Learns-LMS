import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeHoliday,
  makeProgram,
  makeStudent,
  makeTimetableEntry,
  makeTimetableOverride,
} from '../helpers/factories.js';
import {
  getNextClassForStudent,
  resolveWindow,
} from '../../src/services/timetableResolutionService.js';

describe('timetableResolutionService.resolveWindow', () => {
  useMongo();
  useIntegrationSpies();

  async function scaffold() {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    return { program, faculty, course, batch };
  }

  it('expands Mon+Wed 18:00–20:00 entries over a 14-day window', async () => {
    const { faculty, course, batch } = await scaffold();
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1, // Monday
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 3, // Wednesday
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });

    const occurrences = await resolveWindow({
      batchId: batch._id,
      fromIstYmd: '2026-07-06', // Mon
      toIstYmd: '2026-07-19',   // Sun (14 days)
    });
    // 2 Mondays + 2 Wednesdays = 4
    expect(occurrences).toHaveLength(4);
    occurrences.forEach((o) => {
      expect(o.startAt.endsWith('+05:30')).toBe(true);
      expect(o.endAt.endsWith('+05:30')).toBe(true);
      expect(o.isOverride).toBe(false);
      expect(o.isAdded).toBe(false);
    });
    const mondayStart = occurrences.find((o) => o.date === '2026-07-06');
    expect(mondayStart?.startAt).toBe('2026-07-06T18:00:00+05:30');
  });

  it('override cancel removes just that date; recurring returns next week', async () => {
    const { faculty, course, batch } = await scaffold();
    const entry = await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
    });
    await makeTimetableOverride({
      batchId: batch._id,
      entryId: entry._id,
      istDate: '2026-07-06',
      action: 'cancel',
    });

    const occurrences = await resolveWindow({
      batchId: batch._id,
      fromIstYmd: '2026-07-06',
      toIstYmd: '2026-07-13',
    });
    // Mon 6 July cancelled, Mon 13 July survives.
    expect(occurrences.map((o) => o.date)).toEqual(['2026-07-13']);
  });

  it('override reschedule adjusts just that occurrence', async () => {
    const { faculty, course, batch } = await scaffold();
    const entry = await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 3,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    await makeTimetableOverride({
      batchId: batch._id,
      entryId: entry._id,
      istDate: '2026-07-08',
      action: 'reschedule',
      newStartMinutes: 1140, // 19:00
      newEndMinutes: 1260,   // 21:00
    });

    const occurrences = await resolveWindow({
      batchId: batch._id,
      fromIstYmd: '2026-07-08',
      toIstYmd: '2026-07-15',
    });
    expect(occurrences).toHaveLength(2);
    const rescheduled = occurrences.find((o) => o.date === '2026-07-08');
    expect(rescheduled?.startAt).toBe('2026-07-08T19:00:00+05:30');
    expect(rescheduled?.isOverride).toBe(true);
    const nextWeek = occurrences.find((o) => o.date === '2026-07-15');
    expect(nextWeek?.startAt).toBe('2026-07-15T18:00:00+05:30');
    expect(nextWeek?.isOverride).toBe(false);
  });

  it('override add injects a synthetic occurrence with entryId=null', async () => {
    const { faculty, course, batch } = await scaffold();
    await makeTimetableOverride({
      batchId: batch._id,
      entryId: null,
      istDate: '2026-07-09',
      action: 'add',
      newCourseId: course._id,
      newFacultyId: faculty._id,
      newStartMinutes: 900,
      newEndMinutes: 1020,
      newRoom: 'Lab 3',
    });

    const occurrences = await resolveWindow({
      batchId: batch._id,
      fromIstYmd: '2026-07-09',
      toIstYmd: '2026-07-09',
    });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.entryId).toBeNull();
    expect(occurrences[0]!.isAdded).toBe(true);
    expect(occurrences[0]!.startAt).toBe('2026-07-09T15:00:00+05:30');
  });

  it('holiday removes the whole IST day for all entries', async () => {
    const { faculty, course, batch } = await scaffold();
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 6, // Saturday 2026-08-15
    });
    await makeHoliday({ istDate: '2026-08-15', name: 'Independence Day' });

    const occurrences = await resolveWindow({
      batchId: batch._id,
      fromIstYmd: '2026-08-15',
      toIstYmd: '2026-08-22',
    });
    // 2026-08-15 Sat dropped; 2026-08-22 Sat survives.
    expect(occurrences.map((o) => o.date)).toEqual(['2026-08-22']);
  });

  it('getNextClassForStudent returns the first upcoming occurrence', async () => {
    const { program, faculty, course, batch } = await scaffold();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
      validFrom: new Date('2026-07-01T00:00:00Z'),
      validTo: new Date('2027-07-01T00:00:00Z'),
    });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
    });
    // Freeze "now" to Sunday 2026-07-05T00:00:00 IST (= 2026-07-04T18:30:00Z).
    const now = new Date('2026-07-04T18:30:00.000Z');
    const next = await getNextClassForStudent(student._id, now);
    expect(next?.date).toBe('2026-07-06');
    expect(next?.startAt).toBe('2026-07-06T18:00:00+05:30');
  });

  it('getNextClassForStudent returns null when no active enrolment', async () => {
    const { user: student } = await makeStudent();
    const next = await getNextClassForStudent(student._id);
    expect(next).toBeNull();
  });
});
