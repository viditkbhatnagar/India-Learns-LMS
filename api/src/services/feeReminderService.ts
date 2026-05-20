import { Types } from 'mongoose';
import type {
  FeeReminderJobResult,
  FeeReminderTemplate,
  NotificationType,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  FeeInstallment,
  User,
  type HydratedFeeInstallment,
} from '../models/index.js';
import { nowUtc } from './clockService.js';
import { enqueueNotification } from './notificationService.js';
import { formatPaiseAsRupees } from './amountInWordsService.js';
import { recordAudit } from './auditService.js';
import { getIntegrations } from '../integrations/index.js';
import { logger } from '../config/logger.js';

const DAY_MS = 86_400_000;

// PRD §9.4 — 7 fire points per installment, expressed in days relative to dueDate.
export const REMINDER_FIRE_POINTS: Array<{
  template: FeeReminderTemplate;
  offsetDays: number;
  titlePrefix: string;
}> = [
  { template: 'fees.upcoming.14d', offsetDays: -14, titlePrefix: 'Fee due in 14 days' },
  { template: 'fees.upcoming.7d', offsetDays: -7, titlePrefix: 'Fee due in 7 days' },
  { template: 'fees.due.today', offsetDays: 0, titlePrefix: 'Fee due today' },
  { template: 'fees.overdue.3d', offsetDays: 3, titlePrefix: 'Fee overdue (3 days)' },
  { template: 'fees.warning.1', offsetDays: 14, titlePrefix: 'Warning 1 — fee overdue' },
  { template: 'fees.warning.2', offsetDays: 21, titlePrefix: 'Warning 2 — fee overdue' },
  { template: 'fees.suspended', offsetDays: 28, titlePrefix: 'Access suspended — fee overdue' },
];

const TEMPLATE_SET = new Set<FeeReminderTemplate>(
  REMINDER_FIRE_POINTS.map((p) => p.template),
);

function bodyFor(
  template: FeeReminderTemplate,
  ctx: { amountRupees: string; installmentLabel: string; dueIst: string },
): string {
  const tail = `Installment: ${ctx.installmentLabel}\nAmount: ${ctx.amountRupees}\nDue: ${ctx.dueIst}`;
  switch (template) {
    case 'fees.upcoming.14d':
      return `A heads-up: a fee installment is due in 14 days.\n\n${tail}`;
    case 'fees.upcoming.7d':
      return `Friendly reminder: your next fee installment is due in 7 days.\n\n${tail}`;
    case 'fees.due.today':
      return `Your fee installment is due today. Please pay to avoid overdue notices.\n\n${tail}`;
    case 'fees.overdue.3d':
      return `Your fee installment is 3 days overdue. Please pay as soon as possible.\n\n${tail}`;
    case 'fees.warning.1':
      return `Warning 1: your fee installment is 14 days overdue. Two more weeks to suspension.\n\n${tail}`;
    case 'fees.warning.2':
      return `Warning 2: your fee installment is 21 days overdue. One week to suspension.\n\n${tail}`;
    case 'fees.suspended':
      return `Your access has been suspended because a fee installment is 28 days overdue.\n\n${tail}`;
    default: {
      const exhaustive: never = template;
      return exhaustive;
    }
  }
}

function firePointsDueForInstallment(
  installment: HydratedFeeInstallment,
  now: Date,
): Array<(typeof REMINDER_FIRE_POINTS)[number]> {
  const alreadySent = new Set(
    installment.remindersSent
      .map((r) => r.template)
      .filter((t): t is FeeReminderTemplate => TEMPLATE_SET.has(t)),
  );
  const due: Array<(typeof REMINDER_FIRE_POINTS)[number]> = [];
  for (const point of REMINDER_FIRE_POINTS) {
    if (alreadySent.has(point.template)) continue;
    const scheduledAt = installment.dueDate.getTime() + point.offsetDays * DAY_MS;
    if (scheduledAt <= now.getTime()) {
      due.push(point);
    }
  }
  return due;
}

function refreshStatus(installment: HydratedFeeInstallment, now: Date): void {
  if (installment.status === 'waived' || installment.status === 'paid') return;
  const open = installment.amountPaise - installment.paidPaise;
  if (open <= 0) {
    installment.status = 'paid';
    return;
  }
  if (now.getTime() >= installment.dueDate.getTime()) {
    if (installment.paidPaise > 0) {
      installment.status = 'partial';
    } else {
      installment.status = 'overdue';
    }
  }
}

async function tryAppendReminder(
  installment: HydratedFeeInstallment,
  template: FeeReminderTemplate,
  at: Date,
): Promise<boolean> {
  // Idempotency guard: only append if the template isn't already recorded.
  // Uses an atomic update with a negative match so parallel cron invocations
  // can't double-fire.
  const result = await FeeInstallment.updateOne(
    {
      _id: installment._id,
      'remindersSent.template': { $ne: template },
    },
    {
      $push: { remindersSent: { template, at } },
    },
  );
  return result.modifiedCount > 0;
}

export async function sendReminderForInstallment(
  installment: HydratedFeeInstallment,
  template: FeeReminderTemplate,
  now: Date,
): Promise<boolean> {
  const wrote = await tryAppendReminder(installment, template, now);
  if (!wrote) return false;

  const student = await User.findById(installment.studentId);
  if (!student) return false;

  const amountRupees = formatPaiseAsRupees(
    installment.amountPaise - installment.paidPaise,
  );
  const dueIst = installment.dueDate.toISOString().slice(0, 10);
  const body = bodyFor(template, {
    amountRupees,
    installmentLabel: installment.label,
    dueIst,
  });
  const point = REMINDER_FIRE_POINTS.find((p) => p.template === template);
  const title = point?.titlePrefix ?? template;

  await enqueueNotification({
    type: template as NotificationType,
    recipients: [student._id],
    title,
    body,
    data: {
      installmentId: installment._id.toString(),
      amountPaise: installment.amountPaise,
      paidPaise: installment.paidPaise,
      template,
    },
  });

  await recordAudit({
    actorUserId: null,
    action: 'fees.reminder.sent',
    targetType: 'FeeInstallment',
    targetId: installment._id,
    details: { template, studentId: student._id.toString() },
  });

  // M10i — Parent CC (LMS_Requirements §4). When the student's profile
  // carries a `parentGuardian.email`, send the same reminder text to
  // them as well. The in-app `enqueueNotification` above is the student
  // channel; this is a parallel email-only send so the parent's inbox
  // gets it without our notification engine treating them as a User row.
  // Best-effort: a bad parent email doesn't trap the student reminder.
  const parentEmail =
    (student as { parentGuardian?: { email?: string | null } | null }).parentGuardian?.email ?? null;
  if (parentEmail) {
    try {
      const { email } = getIntegrations();
      await email.send({
        to: parentEmail,
        subject: `India Learns — ${title} for ${student.name}`,
        text: `Hello,\n\n${body}\n\nThis is sent because ${student.name} has listed you as their parent / guardian. Please contact the programme office for any questions.\n\nIndia Learns`,
        html: `<p>Hello,</p><p>${body.replace(/\n/g, '<br>')}</p><p>This is sent because ${student.name} has listed you as their parent / guardian. Please contact the programme office for any questions.</p>`,
        tag: `${template}.parent`,
      });
    } catch (err) {
      logger.warn(
        { err, studentId: student._id.toString(), template },
        'fee_reminder.parent_email_failed',
      );
    }
  }

  return true;
}

export async function run(
  now: Date = nowUtc(),
): Promise<FeeReminderJobResult> {
  // Look at installments whose earliest fire point (T-14) is already due.
  const cutoff = new Date(now.getTime() + 14 * DAY_MS);
  const installments = await FeeInstallment.find({
    status: { $in: ['pending', 'partial', 'overdue'] },
    dueDate: { $lte: cutoff },
  });

  const result: FeeReminderJobResult = {
    processed: 0,
    notificationsEnqueued: 0,
    skipped: 0,
    errors: [],
  };

  for (const installment of installments) {
    result.processed += 1;
    refreshStatus(installment, now);
    if (installment.status === 'paid' || installment.status === 'waived') {
      await installment.save();
      result.skipped += 1;
      continue;
    }
    const due = firePointsDueForInstallment(installment, now);
    if (due.length === 0) {
      // Status may still have changed (pending → overdue) so save it.
      if (installment.isModified('status')) await installment.save();
      result.skipped += 1;
      continue;
    }
    for (const point of due) {
      try {
        const sent = await sendReminderForInstallment(installment, point.template, now);
        if (sent) result.notificationsEnqueued += 1;
      } catch (err) {
        result.errors.push({
          installmentId: installment._id.toString(),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (installment.isModified('status')) await installment.save();
  }

  return result;
}

export async function sendManualReminder(
  installmentId: string,
  now: Date = nowUtc(),
): Promise<{ processed: number; skipped: number }> {
  if (!Types.ObjectId.isValid(installmentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Installment not found.');
  }
  const installment = await FeeInstallment.findById(installmentId);
  if (!installment) {
    throw new HttpError(404, 'NOT_FOUND', 'Installment not found.');
  }
  refreshStatus(installment, now);
  const due = firePointsDueForInstallment(installment, now);
  let processed = 0;
  let skipped = 0;
  for (const point of due) {
    const sent = await sendReminderForInstallment(installment, point.template, now);
    if (sent) processed += 1;
    else skipped += 1;
  }
  if (installment.isModified('status')) await installment.save();
  return { processed, skipped };
}
