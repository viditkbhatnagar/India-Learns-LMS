import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
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

describe('GET /v1/timetable?batchId=&from=&to= (resolution)', () => {
  useMongo();
  useIntegrationSpies();

  async function buildWorld() {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    const wed = await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 3,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });
    await makeTimetableOverride({
      batchId: batch._id,
      entryId: wed._id,
      istDate: '2026-07-08',
      action: 'reschedule',
      newStartMinutes: 1140,
      newEndMinutes: 1260,
    });
    return { admin, at, program, faculty, course, batch };
  }

  it('returns resolved occurrences for a 14-day window with +05:30 ISO strings', async () => {
    const { at, batch } = await buildWorld();
    const res = await http()
      .get(`/v1/timetable?batchId=${batch._id.toString()}&from=2026-07-06&to=2026-07-19`)
      .set(bearer(at));
    expect(res.status).toBe(200);
    const occurrences = res.body.data.occurrences as Array<{
      date: string;
      startAt: string;
      endAt: string;
      isOverride: boolean;
    }>;
    // Mon 6, Wed 8 (rescheduled), Mon 13, Wed 15, Mon 20 is outside, so 4.
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    occurrences.forEach((o) => {
      expect(o.startAt.endsWith('+05:30')).toBe(true);
      expect(o.endAt.endsWith('+05:30')).toBe(true);
    });
    const wed8 = occurrences.find((o) => o.date === '2026-07-08');
    expect(wed8?.startAt).toBe('2026-07-08T19:00:00+05:30');
    expect(wed8?.isOverride).toBe(true);
    const wed15 = occurrences.find((o) => o.date === '2026-07-15');
    expect(wed15?.startAt).toBe('2026-07-15T18:00:00+05:30');
    expect(wed15?.isOverride).toBe(false);
  });

  it('a holiday removes the IST day across all batches', async () => {
    const { at } = await buildWorld();
    // Seed a 2nd batch + entry on Saturday 2026-08-15 (Independence Day).
    const program2 = await makeProgram();
    const { user: fac2 } = await makeFaculty();
    const course2 = await makeCourse({
      programId: program2._id,
      state: 'published',
      facultyIds: [fac2._id],
    });
    const batch2 = await makeBatch({ programId: program2._id });
    await makeTimetableEntry({
      batchId: batch2._id,
      courseId: course2._id,
      facultyId: fac2._id,
      dayOfWeek: 6,
    });
    await makeHoliday({ istDate: '2026-08-15', name: 'Independence Day' });

    const res = await http()
      .get(`/v1/timetable?batchId=${batch2._id.toString()}&from=2026-08-15&to=2026-08-22`)
      .set(bearer(at));
    expect(res.status).toBe(200);
    const dates = (res.body.data.occurrences as Array<{ date: string }>).map((o) => o.date);
    expect(dates).toEqual(['2026-08-22']);
  });

  it('student enrolled in batch can resolve their timetable; non-enrolled student 403s', async () => {
    const { batch, course, program } = await buildWorld();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const at = await tokenFor(student);
    const ok = await http()
      .get(`/v1/timetable?batchId=${batch._id.toString()}&from=2026-07-06&to=2026-07-19`)
      .set(bearer(at));
    expect(ok.status).toBe(200);

    const { user: stranger } = await makeStudent();
    const atStranger = await tokenFor(stranger);
    const forbidden = await http()
      .get(`/v1/timetable?batchId=${batch._id.toString()}&from=2026-07-06&to=2026-07-19`)
      .set(bearer(atStranger));
    expect(forbidden.status).toBe(403);
  });

  it('window > 90 days is rejected', async () => {
    const { at, batch } = await buildWorld();
    const res = await http()
      .get(`/v1/timetable?batchId=${batch._id.toString()}&from=2026-01-01&to=2026-12-31`)
      .set(bearer(at));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE_WINDOW');
  });
});
