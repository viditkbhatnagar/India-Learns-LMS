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
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';

describe('POST /v1/enrollments', () => {
  useMongo();
  useIntegrationSpies();

  async function buildProgram(courseCount = 2) {
    const program = await makeProgram();
    await Promise.all(
      Array.from({ length: courseCount }).map((_, i) =>
        makeCourse({ programId: program._id, slug: `c${i}`, name: `C${i}`, state: 'published' }),
      ),
    );
    const batch = await makeBatch({ programId: program._id, capacity: 30 });
    return { program, batch };
  }

  it('admin enrols student → N enrolments created (one per course)', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const { program, batch } = await buildProgram(3);
    const { user: student } = await makeStudent();

    const res = await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(3);
  });

  it('student sees only own enrolments at GET /v1/enrollments/me and /v1/me/courses', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const { program, batch } = await buildProgram(2);
    const { user: student } = await makeStudent();
    await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });

    const stuAt = await tokenFor(student);
    const mine = await http().get('/v1/enrollments/me').set(bearer(stuAt));
    expect(mine.status).toBe(200);
    expect(mine.body.data.enrolments.length).toBe(2);

    const alias = await http().get('/v1/me/courses').set(bearer(stuAt));
    expect(alias.status).toBe(200);
    expect(alias.body.data.enrolments.length).toBe(2);
  });

  it('duplicate enrolment returns ENROLLMENT_DUPLICATE', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const { program, batch } = await buildProgram(1);
    const { user: student } = await makeStudent();
    await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    const dup = await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ENROLLMENT_DUPLICATE');
  });

  it('refuses over-capacity: BATCH_FULL', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    await makeCourse({ programId: program._id, slug: 'only' });
    const batch = await makeBatch({ programId: program._id, capacity: 1 });
    const { user: s1 } = await makeStudent();
    const { user: s2 } = await makeStudent();
    await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: s1._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    const res = await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: s2._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BATCH_FULL');
  });

  it('admin can PATCH enrolment to revoke status', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const { program, batch } = await buildProgram(1);
    const { user: student } = await makeStudent();
    const created = await http()
      .post('/v1/enrollments')
      .set(bearer(at))
      .send({
        studentId: student._id.toString(),
        programId: program._id.toString(),
        batchId: batch._id.toString(),
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2027-07-01T00:00:00Z',
      });
    const eid = created.body.data.enrolments[0].id;
    const res = await http()
      .patch(`/v1/enrollments/${eid}`)
      .set(bearer(at))
      .send({ status: 'revoked' });
    expect(res.status).toBe(200);
    expect(res.body.data.enrolment.status).toBe('revoked');
  });
});
