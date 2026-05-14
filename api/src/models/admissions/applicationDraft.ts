import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M2 — Per-applicant working draft of the multi-step form. One document per
// Application, replaced in-place via PUT. Step shapes are stored as opaque
// JSON (Mixed) so we can evolve the form without a migration; the API + UI
// validate shape on write and on submit.
//
// `data` is treated as a JSON record keyed by step name (e.g. `step2_personal`,
// `step3_contact`, `step4_program`, `step5_academic`). Each value is opaque
// — services that read specific shapes assert at call time. `completedSteps`
// is a parallel array so the officer dashboard can show progress without
// having to inspect the JSON.

export const APPLICATION_DRAFT_STEPS = [
  'step2_personal',
  'step3_contact',
  'step4_program',
  'step5_academic',
  'step6_documents',
  'step7_statement',
  'step8_references',
  'step9_consents',
] as const;
export type ApplicationDraftStep = (typeof APPLICATION_DRAFT_STEPS)[number];

export interface ApplicationDraftDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  data: Record<string, unknown>;
  completedSteps: ApplicationDraftStep[];
  lastModifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationDraftSchema = new Schema<ApplicationDraftDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      unique: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    completedSteps: {
      type: [String],
      enum: APPLICATION_DRAFT_STEPS,
      default: [],
    },
    lastModifiedAt: { type: Date, default: () => new Date() },
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

// TTL: drafts older than 90 days auto-purge (Q5 default; can be overridden by
// env in M9 when the cleanup-cron lands).
ApplicationDraftSchema.index(
  { lastModifiedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 },
);

export type HydratedApplicationDraft = HydratedDocument<ApplicationDraftDoc>;

export const ApplicationDraft =
  (mongoose.models.ApplicationDraft as
    | mongoose.Model<ApplicationDraftDoc>
    | undefined) ??
  model<ApplicationDraftDoc>('ApplicationDraft', ApplicationDraftSchema);
