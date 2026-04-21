import mongoose, { Schema, model, type Types } from 'mongoose';
import type { InviteTokenKind } from 'india-learns-shared-types';

export interface InviteTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  kind: InviteTokenKind;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InviteTokenSchema = new Schema<InviteTokenDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ['invite', 'reset'], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Auto-purge expired tokens after they lapse (Mongo TTL monitor).
InviteTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const InviteToken =
  (mongoose.models.InviteToken as mongoose.Model<InviteTokenDoc> | undefined) ??
  model<InviteTokenDoc>('InviteToken', InviteTokenSchema);
