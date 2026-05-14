import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { ApplicationState } from 'india-learns-shared-types';

// M1–M5 — Application is the central row for the admissions module.
//
// At M1, it carries the lifecycle skeleton (applicantUserId, code, state).
// M3a adds `statement` (single long-text field for personal statement / SOP
// per simplified scope). M4 adds the FERPA-style consent embedded doc, the
// directory-information flag map, and the annual FERPA acknowledgement
// timestamp. The Application row is immutable after `submitted` from the
// applicant's side; officers can still mutate `decision`, `withdrawnReason`,
// and consents (when re-acknowledged).

export interface ApplicationDecisionDoc {
  decision: 'admit' | 'deny' | 'waitlist' | null;
  decidedAt: Date | null;
  decidedBy: Types.ObjectId | null;
  reasonInternal: string | null;
  reasonApplicant: string | null;
}

export interface ApplicationConsentDoc {
  acknowledged: boolean;
  atUtc: Date | null;
  version: string;
}

export interface ApplicationConsentsDoc {
  truthfulness: ApplicationConsentDoc;
  terms: ApplicationConsentDoc;
  ferpaNotice: ApplicationConsentDoc;
  priorEducationAuth: ApplicationConsentDoc;
  communications: ApplicationConsentDoc;
}

export interface ApplicationDoc {
  _id: Types.ObjectId;
  code: string;
  applicantUserId: Types.ObjectId;
  programId: Types.ObjectId | null;
  // batchId is set at Step 4 for cohort_pick programs; left null for
  // program_only programs (officer assigns at admit).
  batchId: Types.ObjectId | null;
  state: ApplicationState;
  submittedAt: Date | null;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
  statement: string;
  consents: ApplicationConsentsDoc;
  // FERPA data-shape — flagged per-attribute as directory or non-directory.
  // Map<attributeName, 'directory' | 'non_directory'>. No enforcement at M1.
  directoryFlags: Record<string, 'directory' | 'non_directory'>;
  ferpaAnnualAckAtUtc: Date | null;
  decision: ApplicationDecisionDoc;
  createdAt: Date;
  updatedAt: Date;
}

const DecisionSchema = new Schema<ApplicationDecisionDoc>(
  {
    decision: {
      type: String,
      enum: [null, 'admit', 'deny', 'waitlist'],
      default: null,
    },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reasonInternal: { type: String, default: null },
    reasonApplicant: { type: String, default: null },
  },
  { _id: false },
);

const ConsentSchema = new Schema<ApplicationConsentDoc>(
  {
    acknowledged: { type: Boolean, default: false },
    atUtc: { type: Date, default: null },
    version: { type: String, default: 'v1-2026-05' },
  },
  { _id: false },
);

const ConsentsSchema = new Schema<ApplicationConsentsDoc>(
  {
    truthfulness: { type: ConsentSchema, default: () => ({}) },
    terms: { type: ConsentSchema, default: () => ({}) },
    ferpaNotice: { type: ConsentSchema, default: () => ({}) },
    priorEducationAuth: { type: ConsentSchema, default: () => ({}) },
    communications: { type: ConsentSchema, default: () => ({}) },
  },
  { _id: false },
);

const ApplicationSchema = new Schema<ApplicationDoc>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      default: null,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    state: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'under_review',
        'decision_pending',
        'admitted',
        'denied',
        'waitlisted',
        'withdrawn',
      ],
      default: 'draft',
      required: true,
      index: true,
    },
    submittedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    withdrawnReason: { type: String, default: null },
    statement: { type: String, default: '' },
    consents: { type: ConsentsSchema, default: () => ({}) },
    directoryFlags: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    ferpaAnnualAckAtUtc: { type: Date, default: null },
    decision: { type: DecisionSchema, default: () => ({}) },
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

ApplicationSchema.index({ state: 1, createdAt: -1 });
ApplicationSchema.index({ programId: 1, state: 1 });

export type HydratedApplication = HydratedDocument<ApplicationDoc>;

export const Application =
  (mongoose.models.Application as mongoose.Model<ApplicationDoc> | undefined) ??
  model<ApplicationDoc>('Application', ApplicationSchema);
