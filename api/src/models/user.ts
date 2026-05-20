import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  DeptTag,
  Role,
  SuspensionKind,
  UserStatus,
} from 'india-learns-shared-types';

// M10 — Structured personal address. Originally captured on the
// ApplicationDraft step3_contact form; copied here at applicant→student
// conversion so the Student Profile screen can display + edit it without
// re-querying the draft. All fields stay optional so existing students
// (pre-M10) don't break.
export interface PersonalAddressDoc {
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

// M10 — Emergency contact + parent/guardian use the same shape; emergency
// is captured on the apply form at step3, parent/guardian is captured
// either on the apply form (step3 extension) or filled in later on the
// Student Profile screen.
export interface ContactRefDoc {
  name: string;
  relationship: string;
  phoneE164: string;
  email: string | null;
}

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
  address: string | null;
  // M10 — student personal details (LMS_Requirements §1). All nullable
  // so M1-M9 users remain valid. The Profile screen surfaces these for
  // students; admins can edit on behalf via PATCH /v1/users/:id.
  dateOfBirth: Date | null;
  personalAddress: PersonalAddressDoc | null;
  emergencyContact: ContactRefDoc | null;
  parentGuardian: ContactRefDoc | null;
  sessionCap: number;
  // Admissions M9 — FERPA data-shape + MFA. None of these are enforced at
  // ship time; they exist so when US-market expansion turns FERPA on, the
  // schema is already in place and no migration is required.
  mfaEnabled: boolean;
  mfaSecret: string | null;
  directoryFlags: Record<string, 'directory' | 'non_directory'>;
  ferpaAnnualAckAtUtc: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    role: {
      type: String,
      enum: [
        'admin',
        'superadmin',
        'finance',
        'faculty',
        'student',
        'applicant',
        'admissions_officer',
      ],
      required: true,
      index: true,
    },
    // `code` is only set for student + faculty (IL-YYYY-NNNN). For other roles
    // the field stays `null`, so we use a partial index that only indexes string
    // values — prevents `E11000 { code: null }` collisions across admin rows.
    // (Plain `sparse: true` doesn't help in MongoDB 5+ because it still indexes
    // explicit `null` values.)
    code: { type: String, default: null },
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
    address: { type: String, default: null },
    // M10 — Personal-detail expansion. Embedded subdocs so the Profile
    // screen reads them in one find() and edits go through Mongoose
    // validation. _id disabled on the subdocs since they're singletons.
    dateOfBirth: { type: Date, default: null },
    personalAddress: {
      type: new Schema<PersonalAddressDoc>(
        {
          street: { type: String, required: true, trim: true, maxlength: 200 },
          city: { type: String, required: true, trim: true, maxlength: 120 },
          stateProvince: { type: String, default: '', trim: true, maxlength: 120 },
          postalCode: { type: String, default: '', trim: true, maxlength: 32 },
          country: { type: String, required: true, trim: true, maxlength: 80 },
        },
        { _id: false },
      ),
      default: null,
    },
    emergencyContact: {
      type: new Schema<ContactRefDoc>(
        {
          name: { type: String, required: true, trim: true, maxlength: 120 },
          relationship: { type: String, default: '', trim: true, maxlength: 60 },
          phoneE164: {
            type: String,
            required: true,
            match: /^\+\d{6,15}$/,
          },
          email: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            maxlength: 254,
          },
        },
        { _id: false },
      ),
      default: null,
    },
    parentGuardian: {
      type: new Schema<ContactRefDoc>(
        {
          name: { type: String, required: true, trim: true, maxlength: 120 },
          relationship: { type: String, default: '', trim: true, maxlength: 60 },
          phoneE164: {
            type: String,
            required: true,
            match: /^\+\d{6,15}$/,
          },
          email: {
            type: String,
            default: null,
            lowercase: true,
            trim: true,
            maxlength: 254,
          },
        },
        { _id: false },
      ),
      default: null,
    },
    sessionCap: { type: Number, default: 5 },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null },
    directoryFlags: { type: Schema.Types.Mixed, default: () => ({}) },
    ferpaAnnualAckAtUtc: { type: Date, default: null },
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
        // M9 — never expose the MFA secret in API responses.
        delete ret.mfaSecret;
        return ret;
      },
    },
  },
);

UserSchema.index({ role: 1, batchId: 1, status: 1 });
UserSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);

export type HydratedUser = HydratedDocument<UserDoc>;

export const User =
  (mongoose.models.User as mongoose.Model<UserDoc> | undefined) ??
  model<UserDoc>('User', UserSchema);
