import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Types,
} from 'mongoose';

// M8 — per-user notification preferences (TRD §4.10, PRD §14.2).
// `emailByType` and `whatsappByType` are sparse maps keyed on NotificationType.
// Defaults live in the service (missing key → true for email; missing key →
// false for WhatsApp since only the 3 approved templates allow it). In-app is
// always on and NOT user-configurable. We use Mixed rather than Mongoose Map
// because we own the validation + defaults in notificationPrefsService; Map
// casting in Mongoose is brittle across versions for boolean-valued maps.
export interface NotificationPrefsDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  emailByType: Record<string, boolean>;
  whatsappByType: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPrefsSchema = new Schema<NotificationPrefsDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    emailByType: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    whatsappByType: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
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

export type HydratedNotificationPrefs = HydratedDocument<NotificationPrefsDoc>;

export const NotificationPrefs =
  (mongoose.models.NotificationPrefs as
    | mongoose.Model<NotificationPrefsDoc>
    | undefined) ??
  model<NotificationPrefsDoc>('NotificationPrefs', NotificationPrefsSchema);
