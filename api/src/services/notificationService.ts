import { Types } from 'mongoose';
import type {
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
  User,
  type HydratedNotification,
} from '../models/index.js';

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

  if (effectiveChannels.includes('email')) {
    const { email } = getIntegrations();
    await Promise.all(
      docs.map(async (doc) => {
        const target = userById.get(doc.userId.toString());
        if (!target) return;
        try {
          await email.send({
            to: target.email,
            subject: doc.title,
            html: `<p>${escapeHtml(doc.body)}</p>`,
            text: doc.body,
            tag: doc.type,
            vars: { ...doc.data, recipientName: target.name },
          });
          doc.emailSentAt = new Date();
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
      }),
    );
  }

  if (effectiveChannels.includes('whatsapp')) {
    const templateName = WABA_TEMPLATE_BY_TYPE[input.type];
    if (templateName) {
      const { whatsapp } = getIntegrations();
      await Promise.all(
        docs.map(async (doc) => {
          const target = userById.get(doc.userId.toString());
          if (!target || !target.phoneE164) return;
          const vars = waTemplateVars(input.type, target.name, input.data ?? {});
          try {
            await whatsapp.sendTemplate({
              toE164: target.phoneE164,
              templateName,
              languageCode: 'en',
              vars,
            });
            doc.whatsappSentAt = new Date();
            await doc.save();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            doc.whatsappError = message.slice(0, 500);
            await doc.save();
            logger.warn(
              { err, notificationId: doc._id.toString(), type: doc.type },
              'notification.whatsapp_failed',
            );
          }
        }),
      );
    }
  }

  return docs;
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
