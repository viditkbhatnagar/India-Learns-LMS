import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  VISITOR_LEAD_SOURCES,
  VISITOR_LEAD_STATUSES,
  VISITOR_OTP_STATUSES,
  VISITOR_QUALIFICATIONS,
  type VisitorLeadSource,
  type VisitorLeadStatus,
  type VisitorOtpStatus,
  type VisitorQualification,
} from 'india-learns-shared-types';
import type { PersonalAddressDoc } from './user.js';

// M10s — Visitor Lead model. Pre-application prospect captured by
// admin / admissions staff (walk-ins, agent referrals, calls, social
// inbound). No OTP send today (Logan 2026-05-20: "except sending otp");
// `otpVerificationStatus` is a manual flag the admin flips after a
// follow-up call. On Convert, we create an ApplicationDraft prefilled
// with the lead and capture the link in `convertedApplicationId`.

export interface VisitorLeadDoc {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  highestQualification: VisitorQualification | null;
  dateOfBirth: Date | null;
  currentAddress: PersonalAddressDoc | null;
  phoneE164: string;
  email: string | null;
  parentGuardianContact: string | null;
  leadSource: VisitorLeadSource;
  socialMediaId: string | null;
  otpVerificationStatus: VisitorOtpStatus;
  status: VisitorLeadStatus;
  notes: string | null;
  assignedToUserId: Types.ObjectId | null;
  convertedApplicationId: Types.ObjectId | null;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const AddressSchema = new Schema<PersonalAddressDoc>(
  {
    street: { type: String, default: '', maxlength: 200, trim: true },
    city: { type: String, default: '', maxlength: 120, trim: true },
    stateProvince: { type: String, default: '', maxlength: 120, trim: true },
    postalCode: { type: String, default: '', maxlength: 20, trim: true },
    country: { type: String, default: 'India', maxlength: 60, trim: true },
  },
  { _id: false, versionKey: false },
);

const VisitorLeadSchema = new Schema<VisitorLeadDoc>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, required: true, trim: true, maxlength: 120 },
    highestQualification: {
      type: String,
      enum: [...VISITOR_QUALIFICATIONS, null],
      default: null,
    },
    dateOfBirth: { type: Date, default: null },
    currentAddress: { type: AddressSchema, default: null },
    phoneE164: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v: string) => /^\+\d{6,15}$/.test(v),
        message: 'phoneE164 must be E.164 format (+ then 6-15 digits)',
      },
      maxlength: 32,
      // index defined below as a partial unique on active rows.
    },
    email: {
      type: String,
      default: null,
      trim: true,
      maxlength: 254,
      lowercase: true,
    },
    parentGuardianContact: { type: String, default: null, maxlength: 200, trim: true },
    leadSource: {
      type: String,
      enum: VISITOR_LEAD_SOURCES,
      required: true,
      index: true,
    },
    socialMediaId: { type: String, default: null, maxlength: 300, trim: true },
    otpVerificationStatus: {
      type: String,
      enum: VISITOR_OTP_STATUSES,
      default: 'pending',
      index: true,
    },
    status: {
      type: String,
      enum: VISITOR_LEAD_STATUSES,
      default: 'new',
      index: true,
    },
    notes: { type: String, default: null, maxlength: 4000 },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    convertedApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'ApplicationDraft',
      default: null,
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

// One active lead per phone (admin can re-capture once dropped/converted).
VisitorLeadSchema.index(
  { phoneE164: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
VisitorLeadSchema.index({ createdAt: -1 });

export type HydratedVisitorLead = HydratedDocument<VisitorLeadDoc>;
export const VisitorLead = model<VisitorLeadDoc>('VisitorLead', VisitorLeadSchema);
