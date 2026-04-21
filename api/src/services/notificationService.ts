import { Types } from 'mongoose';
import type {
  NotificationChannel,
  NotificationDto,
  NotificationType,
  OverrideAction,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { getIntegrations } from '../integrations/index.js';
import { HttpError } from '../middleware/error.js';
import {
  Enrollment,
  Notification,
  User,
  type HydratedNotification,
} from '../models/index.js';

const CHANNELS_BY_TYPE: Record<NotificationType, NotificationChannel[]> = {
  // BRD §6.1 / PRD US-TT-05: WhatsApp is NOT used for timetable changes.
  'timetable.change': ['inapp', 'email'],
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
  const channels = input.channels ?? typeToChannels(input.type);
  if (input.recipients.length === 0) return [];

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
        channels,
        readAt: null,
        emailSentAt: null,
        emailError: null,
      }),
    ),
  );

  if (channels.includes('email')) {
    const users = await User.find({
      _id: { $in: userIds },
      deletedAt: null,
    }).select('email name');
    const emailByUserId = new Map<string, { email: string; name: string }>();
    users.forEach((u) => {
      emailByUserId.set(u._id.toString(), { email: u.email, name: u.name });
    });
    const { email } = getIntegrations();
    await Promise.all(
      docs.map(async (doc) => {
        const target = emailByUserId.get(doc.userId.toString());
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

  return docs;
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
