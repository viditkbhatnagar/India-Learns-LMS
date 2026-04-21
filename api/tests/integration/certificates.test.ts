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
import { Enrollment } from '../../src/models/index.js';

async function seedCompletedEnrolment() {
  const program = await makeProgram();
  const course = await makeCourse({
    programId: program._id,
    state: 'published',
  });
  const batch = await makeBatch({ programId: program._id });
  const { user: student } = await makeStudent();
  const enrolment = await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
  });
  await Enrollment.updateOne(
    { _id: enrolment._id },
    { $set: { completed: true, completedAt: new Date() } },
  );
  return { program, course, batch, student, enrolment };
}

describe('certificates routes', () => {
  useMongo();
  useIntegrationSpies();

  it('POST /v1/enrollments/:id/issue-certificate (admin) returns 201 the first time and 200 on re-issue', async () => {
    const { user: admin } = await makeAdmin();
    const { enrolment } = await seedCompletedEnrolment();
    const token = await tokenFor(admin);

    const first = await http()
      .post(`/v1/enrollments/${enrolment._id.toString()}/issue-certificate`)
      .set(bearer(token));
    expect(first.status).toBe(201);
    expect(first.body.data.reissued).toBe(false);
    expect(first.body.data.certificate.certificateUrl).toBeTruthy();

    const second = await http()
      .post(`/v1/enrollments/${enrolment._id.toString()}/issue-certificate`)
      .set(bearer(token));
    expect(second.status).toBe(200);
    expect(second.body.data.reissued).toBe(true);
    expect(second.body.data.certificate.certificateUrl).toBe(
      first.body.data.certificate.certificateUrl,
    );
  });

  it('POST /v1/enrollments/:id/issue-certificate rejects non-admin with 403', async () => {
    const { user: student } = await makeStudent();
    const { enrolment } = await seedCompletedEnrolment();
    const token = await tokenFor(student);

    const res = await http()
      .post(`/v1/enrollments/${enrolment._id.toString()}/issue-certificate`)
      .set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('POST returns 409 if enrolment not completed', async () => {
    const { user: admin } = await makeAdmin();
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const enrolment = await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const token = await tokenFor(admin);
    const res = await http()
      .post(`/v1/enrollments/${enrolment._id.toString()}/issue-certificate`)
      .set(bearer(token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ENROLLMENT_NOT_COMPLETED');
  });

  it('GET /v1/me/certificates lists the student\'s own certificates', async () => {
    const { student, enrolment } = await seedCompletedEnrolment();
    const studentToken = await tokenFor(student);
    const { user: admin } = await makeAdmin();
    const adminToken = await tokenFor(admin);

    // Issue via admin.
    await http()
      .post(`/v1/enrollments/${enrolment._id.toString()}/issue-certificate`)
      .set(bearer(adminToken));

    const res = await http()
      .get('/v1/me/certificates')
      .set(bearer(studentToken));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].certificateUrl).toBeTruthy();
  });
});
