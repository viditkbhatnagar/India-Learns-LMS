import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  DeptTag,
  Role,
  SuspensionKind,
  UserStatus,
} from 'india-learns-shared-types';

export interface UserDoc {
  _id: Types.ObjectId;
  role: Role;
  code: string | null;
  name: string;
  email: string;
  phoneE164: string;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
  passwordHistoryHashes: string[];
  status: UserStatus;
  suspensionKind: SuspensionKind | null;
  suspensionReason: string | null;
  suspensionOverrideUntil: Date | null;
  suspensionOverrideBy: Types.ObjectId | null;
  lastLoginAt: Date | null;
  loginFailCount: number;
  lockedUntil: Date | null;
  programId: Types.ObjectId | null;
  batchId: Types.ObjectId | null;
  enrolmentValidFrom: Date | null;
  enrolmentValidTo: Date | null;
  deptTag: DeptTag | null;
  isCourseCoordinator: boolean;
  sessionCap: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    role: {
      type: String,
      enum: ['admin', 'superadmin', 'finance', 'faculty', 'student'],
      required: true,
      index: true,
    },
    code: { type: String, default: null, unique: true, sparse: true },
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phoneE164: { type: String, required: true },
    passwordHash: { type: String, default: null },
    passwordUpdatedAt: { type: Date, default: null },
    passwordHistoryHashes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'revoked'],
      default: 'pending',
      index: true,
    },
    suspensionKind: {
      type: String,
      enum: [null, 'manual', 'fees'],
      default: null,
    },
    suspensionReason: { type: String, default: null },
    suspensionOverrideUntil: { type: Date, default: null },
    suspensionOverrideBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastLoginAt: { type: Date, default: null },
    loginFailCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', default: null },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    enrolmentValidFrom: { type: Date, default: null },
    enrolmentValidTo: { type: Date, default: null },
    deptTag: {
      type: String,
      enum: [null, 'operations', 'it', 'academics', 'finance', 'senior_mgmt'],
      default: null,
    },
    isCourseCoordinator: { type: Boolean, default: false },
    sessionCap: { type: Number, default: 5 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.passwordHash;
        delete ret.passwordHistoryHashes;
        delete ret.loginFailCount;
        delete ret.lockedUntil;
        return ret;
      },
    },
  },
);

UserSchema.index({ role: 1, batchId: 1, status: 1 });

export type HydratedUser = HydratedDocument<UserDoc>;

export const User =
  (mongoose.models.User as mongoose.Model<UserDoc> | undefined) ??
  model<UserDoc>('User', UserSchema);
