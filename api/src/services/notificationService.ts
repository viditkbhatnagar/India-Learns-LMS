import { Types } from 'mongoose';
import type {
  EmailSendInput,
  NotificationChannel,
  NotificationDto,
  NotificationType,
  OverrideAction,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getIntegrations } from '../integrations/index.js';
import { HttpError } from '../middleware/error.js';
import {
  Enrollment,
  Notification,
  NotificationPrefs,
  User,
  type HydratedNotification,
  type HydratedNotificationPrefs,
} from '../models/index.js';
import { recordApiCost } from './apiCostService.js';
import { nowUtc } from './clockService.js';

// BRD §6.1: WhatsApp is reserved for fee-due, payment-received, ticket-updated.
// Timetable does NOT use WhatsApp (D-037). Fee upcoming T-14/T+3 stay email-only.
const CHANNELS_BY_TYPE: Record<NotificationType, NotificationChannel[]> = {
  'timetable.change': ['inapp', 'email'],
  'fees.upcoming.14d': ['inapp', 'email'],
  'fees.upcoming.7d': ['inapp', 'email', 'whatsapp'],
  'fees.due.today': ['inapp', 'email', 'whatsapp'],
  'fees.overdue.3d': ['inapp', 'email'],
  'fees.warning.1': ['inapp', 'email', 'whatsapp'],
  'fees.warning.2': ['inapp', 'email', 'whatsapp'],
  'fees.suspended': ['inapp', 'email', 'whatsapp'],
  'fees.paid': ['inapp', 'email', 'whatsapp'],
  // M6 — PRD §14.3 event registry. State-change is the only ticket event with
  // WhatsApp; comments and breach alerts stay email + in-app.
  'ticket.created': ['inapp', 'email'],
  'ticket.assigned': ['inapp', 'email'],
  'ticket.commented': ['inapp', 'email'],
  'ticket.state_changed': ['inapp', 'email', 'whatsapp'],
  'ticket.sla_ack_breached': ['inapp', 'email'],
  'ticket.sla_resolve_breached': ['inapp', 'email'],
  // M7 — PRD §11.3 + §14.3. Email + in-app only; WhatsApp is not approved for
  // assessment/feedback templates at launch (Q-M7-02).
  'assessment.graded': ['inapp', 'email'],
  'feedback.published': ['inapp', 'email'],
  // M8 — PRD §14.3 line 553. No WhatsApp (not in the 3-template allowlist,
  // D-007); inapp + email only.
  'certificate.issued': ['inapp', 'email'],
  // Post-M9 assignments — inapp + email, no WhatsApp (no approved template).
  'assignment.created': ['inapp', 'email'],
  'assignment.submitted': ['inapp', 'email'],
  'assignment.graded': ['inapp', 'email'],
  // M10i — placement job-posted (LMS_Requirements §3). Email + in-app.
  'placement.job_posted': ['inapp', 'email'],
  // M10j — broad-scope announcements. Email + in-app.
  'announcement.published': ['inapp', 'email'],
  // M10s — admin ping when a student completes a course. Email + in-app
  // (no WhatsApp template approved for this event).
  'student.course_completed': ['inapp', 'email'],
};

// Only three WABA templates are pre-approved at launch (D-007): `il_fee_due`,
// `il_payment_received`, and `il_ticket_update`. Fees map to the first two;
// ticket.state_changed is the sole consumer of the third.
const WABA_TEMPLATE_BY_TYPE: Partial<Record<NotificationType, string>> = {
  'fees.upcoming.7d': 'il_fee_due',
  'fees.due.today': 'il_fee_due',
  'fees.warning.1': 'il_fee_due',
  'fees.warning.2': 'il_fee_due',
  'fees.suspended': 'il_fee_due',
  'fees.paid': 'il_payment_received',
  'ticket.state_changed': 'il_ticket_update',
};

// M8 — WhatsApp is only permitted for NotificationTypes whose map entry in
// WABA_TEMPLATE_BY_TYPE is set. Student prefs that try to enable WhatsApp for
// a non-templated type are rejected at the prefs-update route.
export function typeSupportsWhatsApp(type: NotificationType): boolean {
  return type in WABA_TEMPLATE_BY_TYPE;
}

export function typeToChannels(type: NotificationType): NotificationChannel[] {
  return [...CHANNELS_BY_TYPE[type]];
}

export function toNotificationDto(
  doc: HydratedNotification,
): NotificationDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id: String(json.id),
    userId: doc.userId.toString(),
    type: doc.type,
    title: doc.title,
    body: doc.body,
    data: (doc.data ?? {}) as Record<string, unknown>,
    channels: doc.channels,
    readAt: iso(json.readAt),
    emailSentAt: iso(json.emailSentAt),
    emailError: (json.emailError as string | null) ?? null,
    whatsappSentAt: iso(json.whatsappSentAt),
    whatsappError: (json.whatsappError as string | null) ?? null,
    retryCount: typeof json.retryCount === 'number' ? json.retryCount : 0,
    lastRetryAt: iso(json.lastRetryAt),
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
  };
}

export interface EnqueueNotificationInput {
  type: NotificationType;
  recipients: Types.ObjectId[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
}

export async function enqueueNotification(
  input: EnqueueNotificationInput,
): Promise<HydratedNotification[]> {
  const resolvedChannels = input.channels ?? typeToChannels(input.type);
  if (input.recipients.length === 0) return [];

  const env = loadEnv();
  // Per BRD §6.1 + CLAUDE.md §8: WhatsApp must stay off until WABA keys are
  // loaded. `WHATSAPP_ENABLED=false` silently drops the whatsapp channel so the
  // inapp+email paths still work.
  const effectiveChannels = resolvedChannels.filter((c) => {
    if (c === 'whatsapp' && !env.WHATSAPP_ENABLED) return false;
    return true;
  });

  const unique = new Map<string, Types.ObjectId>();
  input.recipients.forEach((id) => unique.set(id.toString(), id));
  const userIds = Array.from(unique.values());

  const docs = await Promise.all(
    userIds.map((userId) =>
      Notification.create({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        channels: effectiveChannels,
        readAt: null,
        emailSentAt: null,
        emailError: null,
        whatsappSentAt: null,
        whatsappError: null,
        retryCount: 0,
        lastRetryAt: null,
      }),
    ),
  );

  const users = await User.find({
    _id: { $in: userIds },
    deletedAt: null,
  }).select('email name phoneE164');
  const userById = new Map<
    string,
    { email: string; name: string; phoneE164: string }
  >();
  users.forEach((u) => {
    userById.set(u._id.toString(), {
      email: u.email,
      name: u.name,
      phoneE164: u.phoneE164,
    });
  });

  // M8 — batch-load per-user prefs so each recipient can opt-out of email /
  // WhatsApp for this event type. Missing rows default to "on" for email and
  // "on" for WhatsApp (when the type is in the allowlist). In-app is always on.
  const prefsRows = await NotificationPrefs.find({
    userId: { $in: userIds },
  });
  const prefsByUser = new Map<string, HydratedNotificationPrefs>();
  prefsRows.forEach((p) => prefsByUser.set(p.userId.toString(), p));

  function emailEnabledFor(userId: string): boolean {
    const p = prefsByUser.get(userId);
    if (!p || !p.emailByType) return true;
    const v = p.emailByType[input.type];
    return v !== false; // missing key → default on
  }
  function whatsappEnabledFor(userId: string): boolean {
    const p = prefsByUser.get(userId);
    if (!p || !p.whatsappByType) return true;
    const v = p.whatsappByType[input.type];
    return v !== false; // missing key → default on (WhatsApp overall gated by WHATSAPP_ENABLED)
  }

  if (effectiveChannels.includes('email')) {
    await Promise.all(
      docs.map(async (doc) => {
        const target = userById.get(doc.userId.toString());
        if (!target) return;
        if (!emailEnabledFor(doc.userId.toString())) return;
        await dispatchEmailOnce(doc, target);
      }),
    );
  }

  if (effectiveChannels.includes('whatsapp')) {
    const templateName = WABA_TEMPLATE_BY_TYPE[input.type];
    if (templateName) {
      await Promise.all(
        docs.map(async (doc) => {
          const target = userById.get(doc.userId.toString());
          if (!target || !target.phoneE164) return;
          if (!whatsappEnabledFor(doc.userId.toString())) return;
          await dispatchWhatsAppOnce(doc, target, templateName, input.data ?? {});
        }),
      );
    }
  }

  return docs;
}

interface RecipientContact {
  email: string;
  name: string;
  phoneE164: string;
}

// Primary send, with Resend→SendGrid fallback per TRD §9.2. Each successful
// send increments the cost ledger; a fallback win counts both adapter calls.
async function sendEmailWithFallback(
  input: EmailSendInput,
  refId: Types.ObjectId,
): Promise<void> {
  const { email, emailFallback } = getIntegrations();
  try {
    await email.send(input);
    await recordApiCost({
      provider: 'email',
      operation: 'email.send.primary',
      refType: 'Notification',
      refId,
    });
  } catch (primaryErr) {
    if (!emailFallback) throw primaryErr;
    logger.warn(
      { err: primaryErr, to: input.to, tag: input.tag },
      'email.primary_failed_retry_fallback',
    );
    await recordApiCost({
      provider: 'email',
      operation: 'email.send.primary_failed',
      refType: 'Notification',
      refId,
    });
    await emailFallback.send(input);
    await recordApiCost({
      provider: 'email',
      operation: 'email.send.fallback',
      refType: 'Notification',
      refId,
    });
  }
}

async function dispatchEmailOnce(
  doc: HydratedNotification,
  target: RecipientContact,
): Promise<void> {
  try {
    await sendEmailWithFallback(
      {
        to: target.email,
        subject: doc.title,
        html: `<p>${escapeHtml(doc.body)}</p>`,
        text: doc.body,
        tag: doc.type,
        vars: { ...doc.data, recipientName: target.name },
      },
      doc._id,
    );
    doc.emailSentAt = nowUtc();
    doc.emailError = null;
    await doc.save();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    doc.emailError = message.slice(0, 500);
    await doc.save();
    logger.warn(
      { err, notificationId: doc._id.toString(), type: doc.type },
      'notification.email_failed',
    );
  }
}

async function dispatchWhatsAppOnce(
  doc: HydratedNotification,
  target: RecipientContact,
  templateName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { whatsapp } = getIntegrations();
  const vars = waTemplateVars(doc.type, target.name, data);
  try {
    await whatsapp.sendTemplate({
      toE164: target.phoneE164,
      templateName,
      languageCode: 'en',
      vars,
    });
    doc.whatsappSentAt = nowUtc();
    doc.whatsappError = null;
    await doc.save();
    await recordApiCost({
      provider: 'whatsapp',
      operation: `whatsapp.template.${templateName}`,
      refType: 'Notification',
      refId: doc._id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    doc.whatsappError = message.slice(0, 500);
    await doc.save();
    logger.warn(
      { err, notificationId: doc._id.toString(), type: doc.type },
      'notification.whatsapp_failed',
    );
  }
}

function waTemplateVars(
  type: NotificationType,
  name: string,
  data: Record<string, unknown>,
): string[] {
  // `il_fee_due`: [name, componentLabel, amount, dueDate, url]
  // `il_payment_received`: [name, amount, componentLabel, receiptUrl]
  // `il_ticket_update`: [name, ticketCode, status, url]
  const env = loadEnv();
  if (type === 'ticket.state_changed') {
    const ticketCode = (data.ticketCode as string) ?? '';
    const status = (data.state as string) ?? '';
    const ticketId = (data.ticketId as string) ?? '';
    const url = ticketId
      ? `${env.WEB_ORIGIN}/student/tickets/${ticketId}`
      : `${env.WEB_ORIGIN}/student/tickets`;
    return [name, ticketCode, status, url];
  }
  const dashboardUrl = `${env.WEB_ORIGIN}/fees`;
  const amount = typeof data.amountPaise === 'number'
    ? `₹${(data.amountPaise / 100).toFixed(2)}`
    : '';
  const component = (data.installmentLabel as string) ?? (data.component as string) ?? 'Fee';
  const due = (data.dueIst as string) ?? '';
  const receiptUrl = (data.receiptUrl as string) ?? dashboardUrl;
  if (type === 'fees.paid') {
    return [name, amount, component, receiptUrl];
  }
  return [name, component, amount, due, dashboardUrl];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface TimetableChangePayload {
  batchId: Types.ObjectId;
  action: OverrideAction | 'updated' | 'deleted';
  overrideId: Types.ObjectId;
  date: Date;
  istDate: string;
  entryId: Types.ObjectId | null;
  newFacultyId: Types.ObjectId | null;
  originalFacultyId: Types.ObjectId | null;
  batchName: string;
  courseName: string;
  reason: string;
}

export async function notifyTimetableChange(
  payload: TimetableChangePayload,
): Promise<HydratedNotification[]> {
  const recipients = new Set<string>();

  const activeEnrolments = await Enrollment.find({
    batchId: payload.batchId,
    status: 'active',
  }).select('studentId');
  activeEnrolments.forEach((e) => recipients.add(e.studentId.toString()));

  if (payload.originalFacultyId) {
    recipients.add(payload.originalFacultyId.toString());
  }
  if (payload.newFacultyId) {
    recipients.add(payload.newFacultyId.toString());
  }

  const recipientIds = Array.from(recipients).map(
    (id) => new Types.ObjectId(id),
  );

  const actionLabel: Record<string, string> = {
    cancel: 'cancelled',
    reschedule: 'rescheduled',
    add: 'added',
    updated: 'updated',
    deleted: 'removed',
  };
  const verb = actionLabel[payload.action] ?? payload.action;

  const title = `Timetable update: ${payload.courseName} ${verb}`;
  const bodyLines = [
    `Batch: ${payload.batchName}`,
    `Course: ${payload.courseName}`,
    `Date: ${payload.istDate} (IST)`,
    `Change: ${verb}`,
  ];
  if (payload.reason) bodyLines.push(`Reason: ${payload.reason}`);
  const body = bodyLines.join('\n');

  return enqueueNotification({
    type: 'timetable.change',
    recipients: recipientIds,
    title,
    body,
    data: {
      batchId: payload.batchId.toString(),
      entryId: payload.entryId?.toString() ?? null,
      overrideId: payload.overrideId.toString(),
      date: payload.istDate,
      action: payload.action,
    },
  });
}

export async function listNotificationsForUser(
  userId: Types.ObjectId,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<HydratedNotification[]> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  const filter: Record<string, unknown> = { userId };
  if (options.unreadOnly) filter.readAt = null;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
}

export async function markNotificationRead(
  id: string,
  userId: Types.ObjectId,
): Promise<HydratedNotification> {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Notification not found.');
  }
  const doc = await Notification.findOne({ _id: id, userId });
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'Notification not found.');
  }
  if (!doc.readAt) {
    doc.readAt = new Date();
    await doc.save();
  }
  return doc;
}

export async function countUnreadForUser(userId: Types.ObjectId): Promise<number> {
  return Notification.countDocuments({ userId, readAt: null });
}

// M8 — Retry sweep for transient email failures (TRD §9.2 Resend primary +
// SendGrid fallback; BR-13 observability). Runs via `/v1/jobs/notifications-retry`
// every 15 min per D-068. Exponential backoff: minute * 2^retryCount — so
// attempt #1 fires ≥60s after original failure, #2 ≥120s, #3 ≥240s. After 3
// attempts the notification is left as-is and the failure stays visible via
// `emailError` for admin review.
export interface RetryFailedInput {
  now: Date;
  maxAttempts?: number;
  windowHours?: number;
}

export interface RetrySweepResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export async function retryFailedNotifications(
  input: RetryFailedInput,
): Promise<RetrySweepResult> {
  const env = loadEnv();
  const { now } = input;
  const maxAttempts = input.maxAttempts ?? env.NOTIFICATIONS_RETRY_MAX;
  const windowMs = (input.windowHours ?? env.NOTIFICATIONS_RETRY_WINDOW_HOURS) * 3600_000;
  const cutoff = new Date(now.getTime() - windowMs);

  const candidates = await Notification.find({
    createdAt: { $gte: cutoff },
    channels: 'email',
    emailError: { $ne: null },
    emailSentAt: null,
    retryCount: { $lt: maxAttempts },
  })
    .sort({ createdAt: 1 })
    .limit(200);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const userIds = Array.from(new Set(candidates.map((c) => c.userId.toString())));
  const users = await User.find({
    _id: { $in: userIds },
    deletedAt: null,
  }).select('email name phoneE164');
  const userById = new Map<string, RecipientContact>();
  users.forEach((u) =>
    userById.set(u._id.toString(), {
      email: u.email,
      name: u.name,
      phoneE164: u.phoneE164,
    }),
  );

  for (const doc of candidates) {
    const backoffMs = 60_000 * 2 ** doc.retryCount;
    if (
      doc.lastRetryAt
      && now.getTime() - doc.lastRetryAt.getTime() < backoffMs
    ) {
      skipped += 1;
      continue;
    }
    const target = userById.get(doc.userId.toString());
    if (!target) {
      skipped += 1;
      continue;
    }
    doc.retryCount += 1;
    doc.lastRetryAt = now;
    try {
      await sendEmailWithFallback(
        {
          to: target.email,
          subject: doc.title,
          html: `<p>${escapeHtml(doc.body)}</p>`,
          text: doc.body,
          tag: doc.type,
          vars: { ...doc.data, recipientName: target.name },
        },
        doc._id,
      );
      doc.emailSentAt = now;
      doc.emailError = null;
      await doc.save();
      succeeded += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      doc.emailError = message.slice(0, 500);
      await doc.save();
      failed += 1;
      logger.warn(
        { err, notificationId: doc._id.toString(), attempts: doc.retryCount },
        'notification.retry_failed',
      );
    }
  }

  return {
    processed: candidates.length,
    succeeded,
    failed,
    skipped,
  };
}

// Q-M4-03 — nightly retention sweep so the in-app inbox doesn't grow
// unbounded. Two windows, both configurable via env so ops can tighten
// in response to volume without a code change:
//   - READ_RETAIN_DAYS (default 90): once a user has marked a notification
//     read, we keep it for this long before deletion. Most apps surface
//     this as "Cleared notifications older than 3 months".
//   - UNREAD_RETAIN_DAYS (default 365): hard ceiling on unread rows so
//     a dormant student doesn't accumulate a year of fee + class noise.
//
// Idempotent: deletion is a single bulk Mongo op; running twice in the
// same minute deletes once and is a no-op the second time.
export interface CleanupSweepResult {
  readDeleted: number;
  unreadDeleted: number;
  cutoffs: {
    read: Date;
    unread: Date;
  };
}

export interface CleanupNotificationsInput {
  now: Date;
  readRetainDays?: number;
  unreadRetainDays?: number;
}

export async function cleanupOldNotifications(
  input: CleanupNotificationsInput,
): Promise<CleanupSweepResult> {
  const env = loadEnv();
  const readDays = input.readRetainDays ?? env.NOTIFICATIONS_READ_RETAIN_DAYS;
  const unreadDays = input.unreadRetainDays ?? env.NOTIFICATIONS_UNREAD_RETAIN_DAYS;
  const readCutoff = new Date(input.now.getTime() - readDays * 86_400_000);
  const unreadCutoff = new Date(input.now.getTime() - unreadDays * 86_400_000);

  const readRes = await Notification.deleteMany({
    readAt: { $ne: null, $lt: readCutoff },
  });
  const unreadRes = await Notification.deleteMany({
    readAt: null,
    createdAt: { $lt: unreadCutoff },
  });

  return {
    readDeleted: readRes.deletedCount ?? 0,
    unreadDeleted: unreadRes.deletedCount ?? 0,
    cutoffs: {
      read: readCutoff,
      unread: unreadCutoff,
    },
  };
}
