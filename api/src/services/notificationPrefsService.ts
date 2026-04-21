import type { Types } from 'mongoose';
import {
  NOTIFICATION_TYPES,
  type NotificationPrefsDto,
  type NotificationType,
} from 'india-learns-shared-types';
import {
  NotificationPrefs,
  type HydratedNotificationPrefs,
} from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { typeSupportsWhatsApp } from './notificationService.js';
import { recordAudit } from './auditService.js';

// M8 — per-user notification preferences (TRD §4.10, PRD §14.2).
// Defaults: email ON for every event, WhatsApp ON for the 3 pre-approved
// template types only, in-app always ON (not user-configurable). Students
// can toggle email per-event; WhatsApp toggle is only meaningful for types
// where the adapter actually has a WABA template (D-007, D-049).

function defaultPrefsObject(kind: 'email' | 'whatsapp'): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const t of NOTIFICATION_TYPES) {
    if (kind === 'email') {
      m[t] = true;
    } else {
      m[t] = typeSupportsWhatsApp(t);
    }
  }
  return m;
}

export function toNotificationPrefsDto(
  doc: HydratedNotificationPrefs,
): NotificationPrefsDto {
  const email: Record<string, boolean> = { ...(doc.emailByType ?? {}) };
  const whatsapp: Record<string, boolean> = { ...(doc.whatsappByType ?? {}) };
  // Layer defaults for any missing key so the client gets a complete map.
  for (const t of NOTIFICATION_TYPES) {
    if (!(t in email)) email[t] = true;
    if (!(t in whatsapp)) whatsapp[t] = typeSupportsWhatsApp(t);
  }
  return {
    userId: doc.userId.toString(),
    emailByType: email,
    whatsappByType: whatsapp,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getOrCreatePrefsForUser(
  userId: Types.ObjectId,
): Promise<HydratedNotificationPrefs> {
  const existing = await NotificationPrefs.findOne({ userId });
  if (existing) return existing;
  const doc = await NotificationPrefs.create({
    userId,
    emailByType: defaultPrefsObject('email'),
    whatsappByType: defaultPrefsObject('whatsapp'),
  });
  return doc;
}

export interface UpdatePrefsInput {
  userId: Types.ObjectId;
  emailByType?: Record<string, boolean>;
  whatsappByType?: Record<string, boolean>;
}

export async function updatePrefsForUser(
  input: UpdatePrefsInput,
): Promise<HydratedNotificationPrefs> {
  const doc = await getOrCreatePrefsForUser(input.userId);
  const before = {
    emailByType: { ...(doc.emailByType ?? {}) },
    whatsappByType: { ...(doc.whatsappByType ?? {}) },
  };

  // Work with fresh copies so Mongoose notices the change (Mixed paths don't
  // track deep mutations automatically).
  const nextEmail: Record<string, boolean> = { ...(doc.emailByType ?? {}) };
  const nextWhatsApp: Record<string, boolean> = { ...(doc.whatsappByType ?? {}) };

  if (input.emailByType) {
    for (const [key, value] of Object.entries(input.emailByType)) {
      if (!(NOTIFICATION_TYPES as readonly string[]).includes(key)) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `Unknown notification type: ${key}`,
        );
      }
      nextEmail[key] = value;
    }
  }
  if (input.whatsappByType) {
    for (const [key, value] of Object.entries(input.whatsappByType)) {
      if (!(NOTIFICATION_TYPES as readonly string[]).includes(key)) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `Unknown notification type: ${key}`,
        );
      }
      if (value === true && !typeSupportsWhatsApp(key as NotificationType)) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `WhatsApp is not available for event type "${key}"`,
          { type: key },
        );
      }
      nextWhatsApp[key] = value;
    }
  }
  doc.emailByType = nextEmail;
  doc.whatsappByType = nextWhatsApp;
  doc.markModified('emailByType');
  doc.markModified('whatsappByType');
  await doc.save();

  await recordAudit({
    actorUserId: input.userId,
    action: 'notification.prefs.updated',
    targetType: 'NotificationPrefs',
    targetId: doc._id,
    before,
    after: {
      emailByType: { ...nextEmail },
      whatsappByType: { ...nextWhatsApp },
    },
  });

  return doc;
}
