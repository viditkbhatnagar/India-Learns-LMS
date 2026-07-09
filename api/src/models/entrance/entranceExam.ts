import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  EntranceExamState,
  EntranceQuestionKind,
} from 'india-learns-shared-types';

export interface EntranceQuestionDoc {
  section: string;
  text: string;
  kind: EntranceQuestionKind;
  options: string[];
  // Answer key for MCQ questions (0-based). null for `text` questions, which
  // are graded manually by an admin/teacher.
  correctIndex: number | null;
  points: number;
}

export interface EntranceExamDoc {
  _id: Types.ObjectId;
  title: string;
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  maxAttempts: number;
  questions: EntranceQuestionDoc[];
  state: EntranceExamState;
  opensAt: Date | null;
  closesAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EntranceQuestionSchema = new Schema<EntranceQuestionDoc>(
  {
    section: { type: String, required: true, maxlength: 200 },
    text: { type: String, required: true, maxlength: 8000 },
    kind: { type: String, enum: ['mcq', 'text'], required: true },
    options: { type: [{ type: String, maxlength: 1000 }], default: [] },
    correctIndex: { type: Number, default: null, min: 0 },
    points: { type: Number, required: true, min: 0, default: 1 },
  },
  { _id: false },
);

const EntranceExamSchema = new Schema<EntranceExamDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 240 },
    instructions: { type: String, default: '', maxlength: 4000 },
    durationMinutes: { type: Number, required: true, min: 1, default: 45 },
    totalMarks: { type: Number, required: true, min: 0, default: 20 },
    maxAttempts: { type: Number, required: true, min: 1, default: 1 },
    questions: { type: [EntranceQuestionSchema], default: [] },
    state: {
      type: String,
      enum: ['draft', 'live', 'closed'],
      default: 'draft',
      index: true,
    },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
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

export type HydratedEntranceExam = HydratedDocument<EntranceExamDoc>;

export const EntranceExam =
  (mongoose.models.EntranceExam as mongoose.Model<EntranceExamDoc> | undefined) ??
  model<EntranceExamDoc>('EntranceExam', EntranceExamSchema);
