import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface QuizAttemptAnswerDoc {
  questionIndex: number;
  chosenIndices: number[];
}

export interface QuizAttemptDoc {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  studentId: Types.ObjectId;
  startedAt: Date;
  submittedAt: Date | null;
  answers: QuizAttemptAnswerDoc[];
  scorePercent: number | null;
  passed: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuizAttemptAnswerSchema = new Schema<QuizAttemptAnswerDoc>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    chosenIndices: {
      type: [{ type: Number, min: 0 }],
      default: [],
    },
  },
  { _id: false },
);

const QuizAttemptSchema = new Schema<QuizAttemptDoc>(
  {
    quizId: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    answers: { type: [QuizAttemptAnswerSchema], default: [] },
    scorePercent: { type: Number, default: null, min: 0, max: 100 },
    passed: { type: Boolean, default: null },
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

QuizAttemptSchema.index({ quizId: 1, studentId: 1 });
QuizAttemptSchema.index({ studentId: 1, submittedAt: -1 });

export type HydratedQuizAttempt = HydratedDocument<QuizAttemptDoc>;

export const QuizAttempt =
  (mongoose.models.QuizAttempt as mongoose.Model<QuizAttemptDoc> | undefined) ??
  model<QuizAttemptDoc>('QuizAttempt', QuizAttemptSchema);
