import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeAdmin,
  makeOverdueStudent,
  makeProgram,
} from '../helpers/factories.js';
import {
  applyOverride,
  autoSuspendRun,
  evaluateForStudent,
  reconcileForStudent,
  revokeOverride,
} from '../../src/services/suspensionService.js';
import { recordPayment } from '../../src/services/paymentService.js';
import { Enrollment, User } from '../../src/models/index.js';
import { resetClock } from '../../src/services/clockService.js';

afterEach(() => resetClock());

describe('suspensionService.evaluateForStudent', () => {
  useMongo();
  useIntegrationSpies();

  it('returns active when no installments are overdue', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: -3, // future due
    });
    const evalResult = await evaluateForStudent(student._id);
    expect(evalResult.stage).toBe('active');
  });

  it('returns warn1 at 14 days overdue', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 14,
    });
    expect((await evaluateForStudent(student._id)).stage).toBe('warn1');
  });

  it('returns warn2 at 21 days overdue', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 21,
    });
    expect((await evaluateForStudent(student._id)).stage).toBe('warn2');
  });

  it('returns suspended at 28 days overdue', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 28,
    });
    expect((await evaluateForStudent(student._id)).stage).toBe('suspended');
  });
});

describe('suspensionService.reconcileForStudent', () => {
  useMongo();
  useIntegrationSpies();

  it('flips User.status to suspended + enrolment to suspended at T+28', async () => {
    const program = await makeProgram();
    const { student, enrolment } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { user: admin } = await makeAdmin();
    const res = await reconcileForStudent(student._id, { actorUserId: admin._id });
    expect(res.transitioned).toBe(true);
    expect(res.evaluation.stage).toBe('suspended');
    const reloadedUser = await User.findById(student._id);
    expect(reloadedUser?.status).toBe('suspended');
    expect(reloadedUser?.suspensionKind).toBe('fees');
    const reloadedE = await Enrollment.findById(enrolment._id);
    expect(reloadedE?.accessState).toBe('suspended');
  });

  it('lifts suspension when the installment is paid', async () => {
    const program = await makeProgram();
    const { student, installment } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { user: admin } = await makeAdmin();
    await reconcileForStudent(student._id, { actorUserId: admin._id });

    await recordPayment(
      {
        studentId: String(student._id),
        amountPaise: installment.amountPaise,
        method: 'upi',
      },
      { actorUserId: admin._id },
    );
    const reloaded = await User.findById(student._id);
    expect(reloaded?.status).toBe('active');
    expect(reloaded?.suspensionKind).toBeNull();
  });
});

describe('suspensionService.applyOverride', () => {
  useMongo();
  useIntegrationSpies();

  it('lifts a fees-suspension and flips enrolments to override', async () => {
    const program = await makeProgram();
    const { student, enrolment } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { user: admin } = await makeAdmin();
    await reconcileForStudent(student._id, { actorUserId: admin._id });

    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await applyOverride(
      String(student._id),
      { until, reason: 'Finance waived pending reconciliation' },
      { actorUserId: admin._id },
    );

    const reloadedUser = await User.findById(student._id);
    expect(reloadedUser?.status).toBe('active');
    expect(reloadedUser?.suspensionOverrideUntil).toBeTruthy();
    const reloadedE = await Enrollment.findById(enrolment._id);
    expect(reloadedE?.accessState).toBe('override');
  });

  it('revokeOverride re-suspends if dues still outstanding', async () => {
    const program = await makeProgram();
    const { student } = await makeOverdueStudent({
      programId: program._id,
      daysOverdue: 30,
    });
    const { user: admin } = await makeAdmin();
    const until = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await applyOverride(
      String(student._id),
      { until, reason: 'Override' },
      { actorUserId: admin._id },
    );
    await revokeOverride(String(student._id), { actorUserId: admin._id });
    const reloaded = await User.findById(student._id);
    expect(reloaded?.status).toBe('suspended');
    expect(reloaded?.suspensionKind).toBe('fees');
  });
});

describe('suspensionService.autoSuspendRun', () => {
  useMongo();
  useIntegrationSpies();

  it('suspends every student with an installment past T+28', async () => {
    const program = await makeProgram();
    await makeOverdueStudent({ programId: program._id, daysOverdue: 30 });
    await makeOverdueStudent({ programId: program._id, daysOverdue: 30 });
    await makeOverdueStudent({ programId: program._id, daysOverdue: 10 });
    const res = await autoSuspendRun();
    expect(res.suspended).toBe(2);
    expect(res.evaluated).toBeGreaterThanOrEqual(2);
  });
});
