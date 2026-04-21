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
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';

describe('GET /v1/students/me/dashboard', () => {
  useMongo();
  useIntegrationSpies();

  it('returns enrolments plus M4–M7 stub buckets for a student', async () => {
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, state: 'published' });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const at = await tokenFor(student);
    const res = await http().get('/v1/students/me/dashboard').set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.student.id).toBe(student._id.toString());
    expect(res.body.data.enrolments.length).toBe(1);
    expect(res.body.data.nextClass).toMatchObject({ stub: true, value: null });
    expect(res.body.data.outstandingFees).toMatchObject({ stub: true, totalPaise: 0 });
    expect(res.body.data.openTickets).toMatchObject({ stub: true, count: 0 });
    expect(res.body.data.newFeedback).toMatchObject({ stub: true, count: 0 });
  });

  it('admin 403 (student-scoped route)', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http().get('/v1/students/me/dashboard').set(bearer(at));
    expect(res.status).toBe(403);
  });
});
