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
  createdAt: string;
}
