import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeInstallment,
  makeInvoice,
  makeFeeStructure,
  makeProgram,
  makeStudent,
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
} from '../helpers/factories.js';
import { run } from '../../src/services/feeReminderService.js';
import { FeeInstallment, Notification } from '../../src/models/index.js';
import { resetClock, setTestNow } from '../../src/services/clockService.js';

async function scaffoldSingleInstallment(dueDate: Date) {
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
    totalPaise: 1_000_000,
  });
  const installment = await makeInstallment({
    invoiceId: invoice._id,
    studentId: student._id,
    amountPaise: 1_000_000,
    dueDate,
  });
  return { student, installment };
}

describe('feeReminderService.run fires each point exactly once', () => {
  useMongo();
  useIntegrationSpies();
  afterEach(() => resetClock());

  it('fires T-14 first, then does not re-fire on a second invocation', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const { installment } = await scaffoldSingleInstallment(due);
    // Now = T-14
    setTestNow(new Date('2026-05-18T00:00:00Z'));
    const r1 = await run();
    expect(r1.notificationsEnqueued).toBe(1);
    const r2 = await run();
    expect(r2.notificationsEnqueued).toBe(0);
    const reloaded = await FeeInstallment.findById(installment._id);
    expect(reloaded?.remindersSent.map((r) => r.template)).toEqual([
      'fees.upcoming.14d',
    ]);
  });

  it('fires every fire point across a timeline walk', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    await scaffoldSingleInstallment(due);
    const points: Array<[string, string]> = [
      ['2026-05-18T00:00:00Z', 'fees.upcoming.14d'],
      ['2026-05-25T00:00:00Z', 'fees.upcoming.7d'],
      ['2026-06-01T00:00:00Z', 'fees.due.today'],
      ['2026-06-04T00:00:00Z', 'fees.overdue.3d'],
      ['2026-06-15T00:00:00Z', 'fees.warning.1'],
      ['2026-06-22T00:00:00Z', 'fees.warning.2'],
      ['2026-06-29T00:00:00Z', 'fees.suspended'],
    ];
    let totalSent = 0;
    for (const [when] of points) {
      setTestNow(new Date(when));
      const res = await run();
      totalSent += res.notificationsEnqueued;
    }
    expect(totalSent).toBe(7);
    const notifs = await Notification.find({});
    expect(notifs.map((n) => n.type).sort()).toEqual(
      [
        'fees.upcoming.14d',
        'fees.upcoming.7d',
        'fees.due.today',
        'fees.overdue.3d',
        'fees.warning.1',
        'fees.warning.2',
        'fees.suspended',
      ].sort(),
    );
  });

  it('cumulative run past T+28 fires all 7 points at once, each once', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const { installment } = await scaffoldSingleInstallment(due);
    setTestNow(new Date('2026-07-15T00:00:00Z'));
    const r1 = await run();
    expect(r1.notificationsEnqueued).toBe(7);
    const reloaded = await FeeInstallment.findById(installment._id);
    expect(reloaded?.remindersSent).toHaveLength(7);
    // Second run is a no-op.
    const r2 = await run();
    expect(r2.notificationsEnqueued).toBe(0);
  });

  it('skips paid installments', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const { installment } = await scaffoldSingleInstallment(due);
    installment.paidPaise = installment.amountPaise;
    installment.status = 'paid';
    await installment.save();
    setTestNow(new Date('2026-07-01T00:00:00Z'));
    const res = await run();
    expect(res.notificationsEnqueued).toBe(0);
  });

  it('is concurrency-safe (two parallel runs do not double-fire)', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const { installment } = await scaffoldSingleInstallment(due);
    setTestNow(new Date('2026-05-18T00:00:00Z'));
    const [a, b] = await Promise.all([run(), run()]);
    const total = a.notificationsEnqueued + b.notificationsEnqueued;
    expect(total).toBe(1);
    const reloaded = await FeeInstallment.findById(installment._id);
    expect(reloaded?.remindersSent.length).toBe(1);
  });

  it('transitions status pending → overdue at T0', async () => {
    const due = new Date('2026-06-01T00:00:00Z');
    const { installment } = await scaffoldSingleInstallment(due);
    setTestNow(new Date('2026-06-02T00:00:00Z'));
    await run();
    const reloaded = await FeeInstallment.findById(installment._id);
    expect(reloaded?.status).toBe('overdue');
  });
});
