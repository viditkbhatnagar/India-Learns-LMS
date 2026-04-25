import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { CourseState } from 'india-learns-shared-types';

export interface ProgramLearningOutcomeDoc {
  outcomeId: string;
  code: string;
  outcomeNumber: number | null;
  statement: string;
  bloomLevel: string;
  linkedKSCs: string[];
}

export interface CourseDoc {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  name: string;
  slug: string;
  summary: string;
  state: CourseState;
  publishedAt: Date | null;
  publishedVersion: number;
  sequential: boolean;
  certificateTemplateId: string | null;
  facultyIds: Types.ObjectId[];
  // Curriculum-generator import provenance (Phase A).
  // sourceWorkflowId is the generator workflow _id we last imported from;
  // unique-sparse-indexed below so re-import overwrites in place.
  sourceWorkflowId: string | null;
  sourceWorkflowVersion: string | null; // workflow.updatedAt at import time
  lastSyncedAt: Date | null;
  programLearningOutcomes: ProgramLearningOutcomeDoc[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PLOSchema = new Schema<ProgramLearningOutcomeDoc>(
  {
    outcomeId: { type: String, required: true },
    code: { type: String, required: true },
    outcomeNumber: { type: Number, default: null },
    statement: { type: String, required: true },
    bloomLevel: { type: String, default: '' },
    linkedKSCs: { type: [String], default: [] },
  },
  { _id: false, versionKey: false },
);

const CourseSchema = new Schema<CourseDoc>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    summary: { type: String, default: '' },
    state: {
      type: String,
      enum: ['sandbox', 'published'],
      default: 'sandbox',
      index: true,
    },
    publishedAt: { type: Date, default: null },
    publishedVersion: { type: Number, default: 0 },
    sequential: { type: Boolean, default: false },
    certificateTemplateId: { type: String, default: null },
    facultyIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    sourceWorkflowId: { type: String, default: null },
    sourceWorkflowVersion: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
    programLearningOutcomes: { type: [PLOSchema], default: [] },
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
        return ret;
      },
    },
  },
);

CourseSchema.index({ programId: 1, slug: 1 }, { unique: true });
CourseSchema.index({ state: 1, programId: 1 });
CourseSchema.index({ facultyIds: 1 });
// Idempotent re-import: a workflow can only back one course at a time.
CourseSchema.index(
  { sourceWorkflowId: 1 },
  { unique: true, partialFilterExpression: { sourceWorkflowId: { $type: 'string' } } },
);

export type HydratedCourse = HydratedDocument<CourseDoc>;

export const Course =
  (mongoose.models.Course as mongoose.Model<CourseDoc> | undefined) ??
  model<CourseDoc>('Course', CourseSchema);
