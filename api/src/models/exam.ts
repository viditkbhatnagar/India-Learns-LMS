import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { ExamQuestionKind, QuizState } from 'india-learns-shared-types';

export interface ExamQuestionDoc {
  text: string;
  kind: ExamQuestionKind;
  options: string[];
  correctIndices: number[];
  points: number;
  rubricId: Types.ObjectId | null;
  wordLimit: number | null;
}

export interface ExamDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: ExamQuestionDoc[];
  state: QuizState;
  openAt: Date | null;
  closeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExamQuestionSchema = new Schema<ExamQuestionDoc>(
  {
    text: { type: String, required: true, maxlength: 8000 },
    kind: {
      type: String,
      enum: ['mcq_single', 'mcq_multi', 'essay'],
      required: true,
    },
    options: {
      type: [{ type: String, maxlength: 1000 }],
      default: [],
    },
    correctIndices: {
      type: [{ type: Number, min: 0 }],
      default: [],
    },
    points: { type: Number, required: true, min: 0 },
    rubricId: {
      type: Schema.Types.ObjectId,
      ref: 'Rubric',
      default: null,
    },
    wordLimit: { type: Number, default: null, min: 1 },
  },
  { _id: false },
);

const ExamSchema = new Schema<ExamDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    durationMinutes: { type: Number, default: 120, min: 1 },
    maxAttempts: { type: Number, default: 1, min: 1 },
    passingPercent: { type: Number, default: 50, min: 0, max: 100 },
    questions: { type: [ExamQuestionSchema], default: [] },
    state: {
      type: String,
      enum: ['draft', 'scheduled', 'live', 'closed'],
      default: 'draft',
      index: true,
    },
    openAt: { type: Date, default: null },
    closeAt: { type: Date, default: null },
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

ExamSchema.index({ courseId: 1, state: 1 });

export type HydratedExam = HydratedDocument<ExamDoc>;

export const Exam =
  (mongoose.models.Exam as mongoose.Model<ExamDoc> | undefined) ??
  model<ExamDoc>('Exam', ExamSchema);
