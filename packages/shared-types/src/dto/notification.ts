import type { NotificationChannel, NotificationType } from '../enums.js';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channels: NotificationChannel[];
  readAt: string | null;
  emailSentAt: string | null;
  emailError: string | null;
  whatsappSentAt?: string | null;
  whatsappError?: string | null;
  retryCount?: number;
  lastRetryAt?: string | null;
  createdAt: string;
}

// M8 — per-user notification preferences (TRD §4.10, PRD §14.2).
// `emailByType` and `whatsappByType` map each event type to a boolean; missing
// keys default to true for email / false for whatsapp (WhatsApp only fires for
// the 3 pre-approved templates — D-007 — and is dev-gated by WHATSAPP_ENABLED).
// In-app is always on and not user-configurable.
export interface NotificationPrefsDto {
  userId: string;
  emailByType: Record<string, boolean>;
  whatsappByType: Record<string, boolean>;
  updatedAt: string;
}
