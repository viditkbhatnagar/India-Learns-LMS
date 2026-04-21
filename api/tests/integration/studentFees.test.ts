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
  makeFeeStructure,
  makeProgram,
  makeStudent,
  makeUser,
} from '../helpers/factories.js';
import { generateForEnrollment } from '../../src/services/invoiceGenerationService.js';

describe('GET /v1/students/me/fees (and /:id alias)', () => {
  useMongo();
  useIntegrationSpies();

  async function seed() {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const enrolment = await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    await makeFeeStructure({ programId: program._id });
    const { user: admin } = await makeAdmin();
    await generateForEnrollment(String(enrolment._id), { actorUserId: admin._id });
    return { program, student, admin };
  }

  it('returns totals and installments for the authenticated student', async () => {
    const { student } = await seed();
    const at = await tokenFor(student);
    const res = await http().get('/v1/students/me/fees').set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.fees.invoices).toHaveLength(2);
    expect(res.body.data.fees.installments).toHaveLength(4);
    expect(res.body.data.fees.totalPaise).toBe(1_000_000 + 6_000_000);
    expect(res.body.data.fees.balancePaise).toBe(7_000_000);
    expect(res.body.data.fees.accessState).toBe('active');
  });

  it('admin can fetch another student\'s fees', async () => {
    const { student, admin } = await seed();
    const at = await tokenFor(admin);
    const res = await http()
      .get(`/v1/students/${String(student._id)}/fees`)
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.fees.studentId).toBe(String(student._id));
  });

  it('unrelated student is 403 on peer\'s fees', async () => {
    const { student } = await seed();
    const { user: other } = await makeStudent();
    const at = await tokenFor(other);
    const res = await http()
      .get(`/v1/students/${String(student._id)}/fees`)
      .set(bearer(at));
    expect(res.status).toBe(403);
  });

  it('finance can fetch any student\'s fees', async () => {
    const { student } = await seed();
    const finance = await makeUser({ role: 'finance' });
    const at = await tokenFor(finance);
    const res = await http()
      .get(`/v1/students/${String(student._id)}/fees`)
      .set(bearer(at));
    expect(res.status).toBe(200);
  });
});
