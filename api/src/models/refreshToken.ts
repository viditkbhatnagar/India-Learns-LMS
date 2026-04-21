import mongoose, { Schema, model, type Types } from 'mongoose';

export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  familyId: Types.ObjectId;
  tokenHash: string;
  deviceId: string;
  ua: string;
  ip: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedFromId: Types.ObjectId | null;
  rotatedToId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String, required: true },
    ua: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    rotatedFromId: {
      type: Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
    },
    rotatedToId: {
      type: Schema.Types.ObjectId,
      ref: 'RefreshToken',
      default: null,
    },
  },
  { timestamps: true },
);

// For session-cap eviction: newest active tokens first.
RefreshTokenSchema.index({ userId: 1, revokedAt: 1, createdAt: -1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken =
  (mongoose.models.RefreshToken as mongoose.Model<RefreshTokenDoc> | undefined) ??
  model<RefreshTokenDoc>('RefreshToken', RefreshTokenSchema);
