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
} from '../helpers/factories.js';
import { Invoice, FeeInstallment } from '../../src/models/index.js';

describe('POST /v1/enrollments/:id/generate-fees', () => {
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
    return { admin, enrolment, student };
  }

  it('generates invoices + installments per FeeStructure', async () => {
    const { admin, enrolment, student } = await seed();
    const at = await tokenFor(admin);
    const res = await http()
      .post(`/v1/enrollments/${String(enrolment._id)}/generate-fees`)
      .set(bearer(at));
    expect(res.status).toBe(200);
    // Default factory: registration (one_time) + tuition (monthly_x=3) = 4 installments.
    expect(res.body.data.invoices).toHaveLength(2);
    expect(res.body.data.installments).toHaveLength(4);
    const invoices = await Invoice.find({ studentId: student._id });
    expect(invoices).toHaveLength(2);
    expect(invoices.every((inv) => inv.code.startsWith('INV-'))).toBe(true);
  });

  it('is idempotent on a second invocation', async () => {
    const { admin, enrolment } = await seed();
    const at = await tokenFor(admin);
    await http()
      .post(`/v1/enrollments/${String(enrolment._id)}/generate-fees`)
      .set(bearer(at));
    const second = await http()
      .post(`/v1/enrollments/${String(enrolment._id)}/generate-fees`)
      .set(bearer(at));
    expect(second.status).toBe(200);
    expect(second.body.data.createdCount).toBe(0);
    const installments = await FeeInstallment.find();
    expect(installments.length).toBe(4);
  });

  it('rejects non-admin role (admin-only)', async () => {
    const { enrolment } = await seed();
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post(`/v1/enrollments/${String(enrolment._id)}/generate-fees`)
      .set(bearer(at));
    expect(res.status).toBe(403);
  });
});
