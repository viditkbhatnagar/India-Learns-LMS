import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { FeedbackLevel, FeedbackStatus } from 'india-learns-shared-types';

export interface FeedbackScoreDoc {
  criterionIndex: number;
  score: number | null;
  label: string | null;
}

export interface FeedbackEntryDoc {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  courseId: Types.ObjectId;
  moduleId: Types.ObjectId | null;
  facultyId: Types.ObjectId;
  level: FeedbackLevel;
  assessmentRef: Types.ObjectId | null;
  rubricId: Types.ObjectId | null;
  scores: FeedbackScoreDoc[];
  comments: string;
  summary: string;
  status: FeedbackStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ScoreSchema = new Schema<FeedbackScoreDoc>(
  {
    criterionIndex: { type: Number, required: true, min: 0 },
    score: { type: Number, default: null, min: 0 },
    label: { type: String, default: null, maxlength: 200 },
  },
  { _id: false },
);

const FeedbackEntrySchema = new Schema<FeedbackEntryDoc>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      default: null,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    level: {
      type: String,
      enum: ['assignment', 'module', 'assessment'],
      required: true,
    },
    assessmentRef: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    rubricId: {
      type: Schema.Types.ObjectId,
      ref: 'Rubric',
      default: null,
    },
    scores: { type: [ScoreSchema], default: [] },
    comments: { type: String, default: '', maxlength: 16_000 },
    summary: { type: String, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date, default: null },
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

// Student feedback inbox: newest-first, published only (status filter applied at query time).
FeedbackEntrySchema.index({ studentId: 1, status: 1, publishedAt: -1 });
// Faculty work queue + digest query.
FeedbackEntrySchema.index({ facultyId: 1, status: 1, createdAt: -1 });
// Coverage aggregates per course.
FeedbackEntrySchema.index({ courseId: 1, level: 1, status: 1 });

export type HydratedFeedbackEntry = HydratedDocument<FeedbackEntryDoc>;

export const FeedbackEntry =
  (mongoose.models.FeedbackEntry as mongoose.Model<FeedbackEntryDoc> | undefined) ??
  model<FeedbackEntryDoc>('FeedbackEntry', FeedbackEntrySchema);
