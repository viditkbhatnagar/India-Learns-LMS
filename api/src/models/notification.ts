import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  NotificationChannel,
  NotificationType,
} from 'india-learns-shared-types';

export interface NotificationDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channels: NotificationChannel[];
  readAt: Date | null;
  emailSentAt: Date | null;
  emailError: string | null;
  whatsappSentAt: Date | null;
  whatsappError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'timetable.change',
        'fees.upcoming.14d',
        'fees.upcoming.7d',
        'fees.due.today',
        'fees.overdue.3d',
        'fees.warning.1',
        'fees.warning.2',
        'fees.suspended',
        'fees.paid',
        'ticket.created',
        'ticket.assigned',
        'ticket.commented',
        'ticket.state_changed',
        'ticket.sla_ack_breached',
        'ticket.sla_resolve_breached',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2000 },
    data: { type: Schema.Types.Mixed, default: {} },
    channels: {
      type: [{ type: String, enum: ['inapp', 'email', 'whatsapp'] }],
      default: ['inapp'],
    },
    whatsappSentAt: { type: Date, default: null },
    whatsappError: { type: String, default: null, maxlength: 500 },
    readAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
    emailError: { type: String, default: null, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export type HydratedNotification = HydratedDocument<NotificationDoc>;

export const Notification =
  (mongoose.models.Notification as mongoose.Model<NotificationDoc> | undefined) ??
  model<NotificationDoc>('Notification', NotificationSchema);
