import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { EntranceAttemptStatus } from 'india-learns-shared-types';

// One answer slot per question. Persisted on every autosave so a dropped
// connection, closed tab, or expired timer never loses what the candidate
// entered. `selectedIndex` holds the chosen MCQ option; `textAnswer` holds the
// verbatim written answer (Q20). Both can coexist harmlessly.
export interface EntranceAttemptAnswerDoc {
  questionIndex: number;
  selectedIndex: number | null;
  textAnswer: string;
  answeredAt: Date | null;
}

export interface EntranceAttemptDoc {
  _id: Types.ObjectId;
  examId: Types.ObjectId;
  candidateId: Types.ObjectId;
  status: EntranceAttemptStatus;
  startedAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  answers: EntranceAttemptAnswerDoc[];
  // Auto-graded MCQ marks, computed at submit. manual + total stay null until an
  // admin scores the written question(s).
  autoScoreMarks: number;
  manualScoreMarks: number | null;
  manualComment: string;
  totalScoreMarks: number | null;
  gradedByUserId: Types.ObjectId | null;
  gradedAt: Date | null;
  ip: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<EntranceAttemptAnswerDoc>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    selectedIndex: { type: Number, default: null, min: 0 },
    textAnswer: { type: String, default: '', maxlength: 40_000 },
    answeredAt: { type: Date, default: null },
  },
  { _id: false },
);

const EntranceAttemptSchema = new Schema<EntranceAttemptDoc>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'EntranceExam',
      required: true,
      index: true,
    },
    // Unique — a candidate takes the paper exactly once. The attempt doc is
    // created at start and mutated in place by autosave/submit.
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'EntranceCandidate',
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'graded'],
      default: 'in_progress',
      index: true,
    },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    autoSubmitted: { type: Boolean, default: false },
    answers: { type: [AnswerSchema], default: [] },
    autoScoreMarks: { type: Number, default: 0, min: 0 },
    manualScoreMarks: { type: Number, default: null, min: 0 },
    manualComment: { type: String, default: '', maxlength: 4000 },
    totalScoreMarks: { type: Number, default: null, min: 0 },
    gradedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    gradedAt: { type: Date, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
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

EntranceAttemptSchema.index({ examId: 1, status: 1 });

export type HydratedEntranceAttempt = HydratedDocument<EntranceAttemptDoc>;

export const EntranceAttempt =
  (mongoose.models.EntranceAttempt as
    | mongoose.Model<EntranceAttemptDoc>
    | undefined) ??
  model<EntranceAttemptDoc>('EntranceAttempt', EntranceAttemptSchema);
