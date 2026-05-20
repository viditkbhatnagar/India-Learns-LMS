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
import { generateForEnrollment } from '../../src/services/invoiceGenerationService.js';

async function seedStudentWithFees() {
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
  // M10r — `finance` role removed; admin records payments now.
  return { student, finance: admin };
}

describe('POST /v1/payments', () => {
  useMongo();
  useIntegrationSpies();

  it('admin records a payment; receipt is issued; download works', async () => {
    const { student, finance } = await seedStudentWithFees();
    const at = await tokenFor(finance);
    const res = await http()
      .post('/v1/payments')
      .set(bearer(at))
      .send({
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
        reference: 'UPI-TEST-1',
      });
    expect(res.status).toBe(201);
    const receiptId = res.body.data.receipt.id as string;
    expect(res.body.data.receipt.code).toMatch(/^RCP-\d{4}-\d{6}$/);

    const download = await http()
      .get(`/v1/receipts/${receiptId}/download`)
      .set(bearer(at));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/application\/pdf/);
    expect(download.body).toBeInstanceOf(Buffer);
  });

  it('student cannot post /v1/payments (403)', async () => {
    const { student } = await seedStudentWithFees();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/payments')
      .set(bearer(at))
      .send({
        studentId: String(student._id),
        amountPaise: 100_000,
        method: 'upi',
      });
    expect(res.status).toBe(403);
  });

  it('student can download their own receipt', async () => {
    const { student, finance } = await seedStudentWithFees();
    const fAt = await tokenFor(finance);
    const rec = await http()
      .post('/v1/payments')
      .set(bearer(fAt))
      .send({
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
      });
    const receiptId = rec.body.data.receipt.id as string;
    const sAt = await tokenFor(student);
    const download = await http()
      .get(`/v1/receipts/${receiptId}/download`)
      .set(bearer(sAt));
    expect(download.status).toBe(200);
  });
});

describe('POST /v1/payments/:id/reverse', () => {
  useMongo();
  useIntegrationSpies();

  it('reverses within 24h and yields a credit note', async () => {
    const { student, finance } = await seedStudentWithFees();
    const at = await tokenFor(finance);
    const rec = await http()
      .post('/v1/payments')
      .set(bearer(at))
      .send({
        studentId: String(student._id),
        amountPaise: 1_000_000,
        method: 'upi',
      });
    const paymentId = rec.body.data.payment.id as string;
    const rev = await http()
      .post(`/v1/payments/${paymentId}/reverse`)
      .set(bearer(at))
      .send({ reason: 'Duplicate' });
    expect(rev.status).toBe(200);
    expect(rev.body.data.creditNote.amountPaise).toBe(1_000_000);
  });
});
