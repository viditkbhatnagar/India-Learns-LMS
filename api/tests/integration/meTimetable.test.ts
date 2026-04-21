import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
  makeTimetableEntry,
} from '../helpers/factories.js';

describe('GET /v1/me/timetable', () => {
  useMongo();
  useIntegrationSpies();

  it('student resolves their batch via ?week=YYYY-Www', async () => {
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
    });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const at = await tokenFor(student);
    const res = await http()
      .get('/v1/me/timetable?week=2026-W28') // starts Mon 2026-07-06
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.window.from).toBe('2026-07-06');
    expect(res.body.data.window.to).toBe('2026-07-12');
    expect(res.body.data.occurrences).toHaveLength(1);
  });

  it('faculty sees only their own classes', async () => {
    const program = await makeProgram();
    const { user: fac1 } = await makeFaculty();
    const { user: fac2 } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [fac1._id, fac2._id],
    });
    const batch = await makeBatch({ programId: program._id });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: fac1._id,
      dayOfWeek: 1,
    });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: fac2._id,
      dayOfWeek: 2,
    });
    const at1 = await tokenFor(fac1);
    const res = await http()
      .get('/v1/me/timetable?week=2026-W28')
      .set(bearer(at1));
    expect(res.status).toBe(200);
    const dates = res.body.data.occurrences.map((o: { date: string }) => o.date);
    expect(dates).toEqual(['2026-07-06']);
  });

  it('requires week or (from and to)', async () => {
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .get('/v1/me/timetable')
      .set(bearer(at));
    expect(res.status).toBe(422);
  });
});
