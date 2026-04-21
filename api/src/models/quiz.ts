import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { QuizQuestionKind, QuizState } from 'india-learns-shared-types';

export interface QuizQuestionDoc {
  text: string;
  kind: QuizQuestionKind;
  options: string[];
  correctIndices: number[];
  points: number;
}

export interface QuizDoc {
  _id: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: QuizQuestionDoc[];
  state: QuizState;
  openAt: Date | null;
  closeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<QuizQuestionDoc>(
  {
    text: { type: String, required: true, maxlength: 4000 },
    kind: {
      type: String,
      enum: ['mcq_single', 'mcq_multi'],
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
  },
  { _id: false },
);

const QuizSchema = new Schema<QuizDoc>(
  {
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    durationMinutes: { type: Number, default: null, min: 1 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    passingPercent: { type: Number, default: 60, min: 0, max: 100 },
    questions: { type: [QuizQuestionSchema], default: [] },
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

QuizSchema.index({ moduleId: 1, state: 1 });

export type HydratedQuiz = HydratedDocument<QuizDoc>;

export const Quiz =
  (mongoose.models.Quiz as mongoose.Model<QuizDoc> | undefined) ??
  model<QuizDoc>('Quiz', QuizSchema);
