import { Types } from 'mongoose';
import type { EnrollmentAccessState } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Enrollment,
  FeeInstallment,
  User,
  type HydratedUser,
} from '../models/index.js';
import { recordAudit, scrubUser } from './auditService.js';
import { nowUtc } from './clockService.js';
import { enqueueNotification } from './notificationService.js';
import { renderTemplate } from './notificationTemplates.js';

const DAY_MS = 86_400_000;
const WARN1_THRESHOLD_DAYS = 14;
const WARN2_THRESHOLD_DAYS = 21;
const SUSPEND_THRESHOLD_DAYS = 28;

export type SuspensionStage =
  | 'active'
  | 'warn1'
  | 'warn2'
  | 'suspended'
  | 'override';

export interface SuspensionEvaluation {
  stage: SuspensionStage;
  maxOverdueDays: number;
  overdueInstallmentIds: Types.ObjectId[];
  overrideActive: boolean;
}

function daysOverdue(dueDate: Date, now: Date): number {
  return Math.floor((now.getTime() - dueDate.getTime()) / DAY_MS);
}

export async function evaluateForStudent(
  studentId: Types.ObjectId,
  now: Date = nowUtc(),
): Promise<SuspensionEvaluation> {
  const user = await User.findById(studentId);
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }

  const installments = await FeeInstallment.find({
    studentId,
    status: { $in: ['pending', 'partial', 'overdue'] },
  }).select('_id dueDate amountPaise paidPaise');

  let maxOverdue = -1;
  const overdueIds: Types.ObjectId[] = [];
  for (const i of installments) {
    if (i.amountPaise - i.paidPaise <= 0) continue;
    const d = daysOverdue(i.dueDate, now);
    if (d >= 0) {
      overdueIds.push(i._id);
      if (d > maxOverdue) maxOverdue = d;
    }
  }

  const overrideActive = Boolean(
    user.suspensionOverrideUntil &&
      user.suspensionOverrideUntil.getTime() > now.getTime(),
  );

  let stage: SuspensionStage;
  if (overrideActive && maxOverdue >= WARN1_THRESHOLD_DAYS) {
    stage = 'override';
  } else if (maxOverdue >= SUSPEND_THRESHOLD_DAYS) {
    stage = 'suspended';
  } else if (maxOverdue >= WARN2_THRESHOLD_DAYS) {
    stage = 'warn2';
  } else if (maxOverdue >= WARN1_THRESHOLD_DAYS) {
    stage = 'warn1';
  } else {
    stage = 'active';
  }

  return {
    stage,
    maxOverdueDays: Math.max(0, maxOverdue),
    overdueInstallmentIds: overdueIds,
    overrideActive,
  };
}

function stageToAccessState(stage: SuspensionStage): EnrollmentAccessState {
  switch (stage) {
    case 'warn1':
      return 'warn1';
    case 'warn2':
      return 'warn2';
    case 'suspended':
      return 'suspended';
    case 'override':
      return 'override';
    case 'active':
    default:
      return 'active';
  }
}

async function setEnrollmentAccessStates(
  studentId: Types.ObjectId,
  state: EnrollmentAccessState,
): Promise<void> {
  await Enrollment.updateMany(
    { studentId, status: 'active' },
    { $set: { accessState: state } },
  );
}

export interface ReconcileCtx {
  actorUserId: Types.ObjectId | null;
  audit?: boolean;
  ip?: string;
  ua?: string;
}

export interface ReconcileResult {
  student: HydratedUser;
  evaluation: SuspensionEvaluation;
  previousStage: SuspensionStage;
  transitioned: boolean;
}

function currentStage(user: HydratedUser): SuspensionStage {
  if (user.status === 'suspended' && user.suspensionKind === 'fees') return 'suspended';
  if (
    user.suspensionOverrideUntil &&
    user.suspensionOverrideUntil.getTime() > nowUtc().getTime()
  ) {
    return 'override';
  }
  // In-memory only — we can't tell warn1/warn2 from User alone. The caller
  // supplies evaluation to detect transitions.
  return 'active';
}

export async function reconcileForStudent(
  studentId: Types.ObjectId,
  ctx: ReconcileCtx = { actorUserId: null },
  now: Date = nowUtc(),
): Promise<ReconcileResult> {
  const user = await User.findById(studentId);
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }
  const prevStage = currentStage(user);
  const evaluation = await evaluateForStudent(studentId, now);
  const before = scrubUser(user.toJSON());

  const target = evaluation.stage;
  let transitioned = false;

  if (target === 'suspended') {
    if (user.status !== 'suspended' || user.suspensionKind !== 'fees') {
      user.status = 'suspended';
      user.suspensionKind = 'fees';
      user.suspensionReason = `Auto-suspended after ${evaluation.maxOverdueDays} days overdue.`;
      transitioned = true;
    }
  } else if (target === 'override') {
    if (user.status === 'suspended' && user.suspensionKind === 'fees') {
      user.status = 'active';
      user.suspensionKind = null;
      user.suspensionReason = null;
      transitioned = true;
    }
  } else if (user.status === 'suspended' && user.suspensionKind === 'fees') {
    // active / warn1 / warn2 — lift any prior fees-suspension.
    user.status = 'active';
    user.suspensionKind = null;
    user.suspensionReason = null;
    transitioned = true;
  }

  await user.save();
  await setEnrollmentAccessStates(studentId, stageToAccessState(target));

  if (ctx.audit !== false) {
    if (transitioned && target === 'suspended') {
      await recordAudit({
        actorUserId: ctx.actorUserId,
        action: 'fees.suspension.auto_suspended',
        targetType: 'User',
        targetId: user._id,
        before,
        after: scrubUser(user.toJSON()),
        details: { daysOverdue: evaluation.maxOverdueDays },
        ip: ctx.ip,
        ua: ctx.ua,
      });
      {
        const rendered = renderTemplate('fees.suspended', {
          maxOverdueDays: evaluation.maxOverdueDays,
        });
        await enqueueNotification({
          type: 'fees.suspended',
          recipients: [user._id],
          title: rendered.title,
          body: rendered.body,
        });
      }
    }
    if (transitioned && target !== 'suspended' && prevStage === 'suspended') {
      await recordAudit({
        actorUserId: ctx.actorUserId,
        action: 'fees.suspension.lifted',
        targetType: 'User',
        targetId: user._id,
        before,
        after: scrubUser(user.toJSON()),
        ip: ctx.ip,
        ua: ctx.ua,
      });
    }
  }

  return { student: user, evaluation, previousStage: prevStage, transitioned };
}

export interface ApplyOverrideCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export async function applyOverride(
  userId: string,
  params: { until: string; reason: string },
  ctx: ApplyOverrideCtx,
): Promise<HydratedUser> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  if (user.role !== 'student') {
    throw new HttpError(
      409,
      'CONFLICT',
      'Only student accounts can carry a fees override.',
    );
  }
  const until = new Date(params.until);
  if (Number.isNaN(until.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'until is not a valid date.');
  }
  if (until.getTime() <= nowUtc().getTime()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'until must be in the future.');
  }
  if (!params.reason || params.reason.trim().length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'reason is required.');
  }

  const before = scrubUser(user.toJSON());
  user.suspensionOverrideUntil = until;
  user.suspensionOverrideBy = ctx.actorUserId;
  if (user.status === 'suspended' && user.suspensionKind === 'fees') {
    user.status = 'active';
    user.suspensionKind = null;
  }
  user.suspensionReason = `Override: ${params.reason}`;
  await user.save();
  await setEnrollmentAccessStates(user._id, 'override');

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'fees.suspension.override_applied',
    targetType: 'User',
    targetId: user._id,
    before,
    after: scrubUser(user.toJSON()),
    details: { until: until.toISOString(), reason: params.reason },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return user;
}

export async function revokeOverride(
  userId: string,
  ctx: ApplyOverrideCtx,
): Promise<HydratedUser> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  if (!user.suspensionOverrideUntil) {
    throw new HttpError(409, 'CONFLICT', 'No active override on this account.');
  }
  const before = scrubUser(user.toJSON());
  user.suspensionOverrideUntil = null;
  user.suspensionOverrideBy = null;
  await user.save();
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'fees.suspension.override_revoked',
    targetType: 'User',
    targetId: user._id,
    before,
    after: scrubUser(user.toJSON()),
    ip: ctx.ip,
    ua: ctx.ua,
  });
  // Re-run reconcile so the state machine recomputes against the removed
  // override — may re-suspend immediately if dues are still outstanding.
  const result = await reconcileForStudent(user._id, ctx);
  return result.student;
}

export interface AutoSuspendRunResult {
  evaluated: number;
  suspended: number;
  lifted: number;
  warned1: number;
  warned2: number;
  errors: Array<{ studentId: string; message: string }>;
}

export async function autoSuspendRun(
  now: Date = nowUtc(),
): Promise<AutoSuspendRunResult> {
  const withOverdue = await FeeInstallment.aggregate<{ _id: Types.ObjectId }>([
    {
      $match: {
        status: { $in: ['pending', 'partial', 'overdue'] },
        dueDate: { $lte: now },
      },
    },
    { $group: { _id: '$studentId' } },
  ]);
  const alreadySuspended = await User.find({
    status: 'suspended',
    suspensionKind: 'fees',
  }).select('_id');

  const studentIds = new Set<string>();
  withOverdue.forEach((r) => studentIds.add(r._id.toString()));
  alreadySuspended.forEach((u) => studentIds.add(u._id.toString()));

  const result: AutoSuspendRunResult = {
    evaluated: 0,
    suspended: 0,
    lifted: 0,
    warned1: 0,
    warned2: 0,
    errors: [],
  };

  for (const id of studentIds) {
    try {
      const res = await reconcileForStudent(
        new Types.ObjectId(id),
        { actorUserId: null, audit: true },
        now,
      );
      result.evaluated += 1;
      if (res.transitioned && res.evaluation.stage === 'suspended') {
        result.suspended += 1;
      }
      if (
        res.transitioned &&
        res.previousStage === 'suspended' &&
        res.evaluation.stage !== 'suspended'
      ) {
        result.lifted += 1;
      }
      if (res.evaluation.stage === 'warn1') result.warned1 += 1;
      if (res.evaluation.stage === 'warn2') result.warned2 += 1;
    } catch (err) {
      result.errors.push({
        studentId: id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
