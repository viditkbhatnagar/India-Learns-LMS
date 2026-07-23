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

describe('batches CRUD', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates and updates a batch', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const res = await http()
      .post('/v1/batches')
      .set(bearer(at))
      .send({
        programId: program._id.toString(),
        name: 'Aviation Batch 1 — July 2026',
        startDate: '2026-07-01T00:00:00Z',
        endDate: '2026-12-31T00:00:00Z',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.batch.capacity).toBe(30);
    expect(res.body.data.batch.status).toBe('planned');

    const patched = await http()
      .patch(`/v1/batches/${res.body.data.batch.id}`)
      .set(bearer(at))
      .send({ capacity: 25, status: 'active' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.batch.capacity).toBe(25);
    expect(patched.body.data.batch.status).toBe('active');
  });

  it('accepts date-only startDate/endDate (what the date picker sends)', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const res = await http()
      .post('/v1/batches')
      .set(bearer(at))
      .send({
        programId: program._id.toString(),
        name: 'Fashion Batch — date-only',
        startDate: '2026-07-23', // no time component — previously bounced
        endDate: '2026-11-30',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.batch.startDate).toContain('2026-07-23');
  });

  it('validates endDate > startDate', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const res = await http()
      .post('/v1/batches')
      .set(bearer(at))
      .send({
        programId: program._id.toString(),
        name: 'bad',
        startDate: '2027-01-01T00:00:00Z',
        endDate: '2026-01-01T00:00:00Z',
      });
    expect(res.status).toBe(422);
  });

  it('refuses to delete a batch with active enrolments', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
      status: 'active',
    });
    const res = await http()
      .delete(`/v1/batches/${batch._id.toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATCH_IN_USE');
  });

  it('shrinking capacity below active enrolment count returns BATCH_FULL', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id, capacity: 5 });
    const { user: s1 } = await makeStudent();
    const { user: s2 } = await makeStudent();
    await makeEnrollment({
      studentId: s1._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    await makeEnrollment({
      studentId: s2._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const res = await http()
      .patch(`/v1/batches/${batch._id.toString()}`)
      .set(bearer(at))
      .send({ capacity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATCH_FULL');
  });
});
