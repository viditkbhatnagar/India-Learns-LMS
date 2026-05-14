import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M3b — Referee added by the applicant in Step 8. The referee themselves
// isn't a User in our system (they're an external person); we email them a
// tokenized link that lets them upload a letter directly to Cloudinary
// without authenticating. The RefereeUploadToken model below is the
// (single-use, TTL-bound) credential the public route validates.

export const REFEREE_STATUSES = ['invited', 'reminded', 'uploaded', 'expired'] as const;
export type RefereeStatus = (typeof REFEREE_STATUSES)[number];

export interface RefereeDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  name: string;
  relationship: string;
  organization: string;
  email: string;
  phoneE164: string | null;
  status: RefereeStatus;
  invitedAt: Date;
  remindedAt: Date | null;
  uploadedAt: Date | null;
  // Set by the public upload route after a successful upload; the officer
  // view fetches a signed URL by key at view time so we never hand out
  // long-lived direct URLs.
  letterDocumentId: Types.ObjectId | null;
  // Last-resend timestamp; used by the rate-limit guard (1/24h).
  lastResendAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefereeSchema = new Schema<RefereeDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    relationship: { type: String, required: true, trim: true, maxlength: 200 },
    organization: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phoneE164: { type: String, default: null },
    status: {
      type: String,
      enum: REFEREE_STATUSES,
      default: 'invited',
      index: true,
    },
    invitedAt: { type: Date, default: () => new Date() },
    remindedAt: { type: Date, default: null },
    uploadedAt: { type: Date, default: null },
    letterDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'ApplicationDocument',
      default: null,
    },
    lastResendAt: { type: Date, default: null },
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

RefereeSchema.index({ applicationId: 1, email: 1 }, { unique: true });

export type HydratedReferee = HydratedDocument<RefereeDoc>;

export const Referee =
  (mongoose.models.Referee as mongoose.Model<RefereeDoc> | undefined) ??
  model<RefereeDoc>('Referee', RefereeSchema);

// ============================================================================
// RefereeUploadToken — separate from the user-facing InviteToken because the
// referee isn't a User and the InviteToken assumes userId.
// ============================================================================

export interface RefereeUploadTokenDoc {
  _id: Types.ObjectId;
  refereeId: Types.ObjectId;
  applicationId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RefereeUploadTokenSchema = new Schema<RefereeUploadTokenDoc>(
  {
    refereeId: {
      type: Schema.Types.ObjectId,
      ref: 'Referee',
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL: drop expired tokens automatically.
RefereeUploadTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefereeUploadToken =
  (mongoose.models.RefereeUploadToken as
    | mongoose.Model<RefereeUploadTokenDoc>
    | undefined) ??
  model<RefereeUploadTokenDoc>('RefereeUploadToken', RefereeUploadTokenSchema);
