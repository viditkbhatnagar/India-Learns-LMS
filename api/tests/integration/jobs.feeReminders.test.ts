import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeFeeStructure,
  makeInstallment,
  makeInvoice,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';
import { setTestNow, resetClock } from '../../src/services/clockService.js';

afterEach(() => resetClock());

async function scaffold(due: Date) {
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
  const structure = await makeFeeStructure({ programId: program._id });
  const invoice = await makeInvoice({
    enrollmentId: enrolment._id,
    studentId: student._id,
    feeStructureId: structure._id,
  });
  await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: 500_000,
    dueDate: due,
  });
  return { student };
}

describe('POST /v1/jobs/fee-reminders', () => {
  useMongo();
  useIntegrationSpies();

  it('rejects without signature headers (401)', async () => {
    const res = await http().post('/v1/jobs/fee-reminders').send({});
    expect(res.status).toBe(401);
  });

  it('rejects invalid signature (401)', async () => {
    const res = await http()
      .post('/v1/jobs/fee-reminders')
      .set('x-job-signature', 'abcd')
      .set('x-job-timestamp', String(Math.floor(Date.now() / 1000)))
      .send({});
    expect(res.status).toBe(401);
  });

  it('rejects stale timestamp (401)', async () => {
    const { signature } = signJobRequest({});
    const res = await http()
      .post('/v1/jobs/fee-reminders')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', '0')
      .send({});
    expect(res.status).toBe(401);
  });

  it('fires 7 reminders once the installment passes T+28', async () => {
    await scaffold(new Date('2026-06-01T00:00:00Z'));
    setTestNow(new Date('2026-07-05T00:00:00Z'));
    const { signature, timestamp } = signJobRequest({});
    const res = await http()
      .post('/v1/jobs/fee-reminders')
      .set('x-job-signature', signature)
      .set('x-job-timestamp', timestamp)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.notificationsEnqueued).toBe(7);

    // Second call is a no-op.
    const { signature: s2, timestamp: t2 } = signJobRequest({});
    const res2 = await http()
      .post('/v1/jobs/fee-reminders')
      .set('x-job-signature', s2)
      .set('x-job-timestamp', t2)
      .send({});
    expect(res2.body.data.notificationsEnqueued).toBe(0);
  });
});
