import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ExamAttemptAnswerDoc {
  questionIndex: number;
  chosenIndices: number[];
}

export interface ExamAttemptEssayDoc {
  questionIndex: number;
  text: string;
}

export interface ExamAttemptRubricScoreDoc {
  criterionIndex: number;
  score: number | null;
  label: string | null;
}

export interface ExamAttemptGradeDoc {
  questionIndex: number;
  score: number;
  comment: string;
  rubricScores: ExamAttemptRubricScoreDoc[];
}

export interface ExamAttemptDoc {
  _id: Types.ObjectId;
  examId: Types.ObjectId;
  studentId: Types.ObjectId;
  startedAt: Date;
  submittedAt: Date | null;
  answers: ExamAttemptAnswerDoc[];
  essayAnswers: ExamAttemptEssayDoc[];
  mcqScorePercent: number | null;
  essayScorePercent: number | null;
  totalScorePercent: number | null;
  passed: boolean | null;
  grades: ExamAttemptGradeDoc[];
  graderUserId: Types.ObjectId | null;
  gradedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<ExamAttemptAnswerDoc>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    chosenIndices: {
      type: [{ type: Number, min: 0 }],
      default: [],
    },
  },
  { _id: false },
);

const EssaySchema = new Schema<ExamAttemptEssayDoc>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    text: { type: String, default: '', maxlength: 40_000 },
  },
  { _id: false },
);

const RubricScoreSchema = new Schema<ExamAttemptRubricScoreDoc>(
  {
    criterionIndex: { type: Number, required: true, min: 0 },
    score: { type: Number, default: null, min: 0 },
    label: { type: String, default: null, maxlength: 200 },
  },
  { _id: false },
);

const GradeSchema = new Schema<ExamAttemptGradeDoc>(
  {
    questionIndex: { type: Number, required: true, min: 0 },
    score: { type: Number, required: true, min: 0 },
    comment: { type: String, default: '', maxlength: 4000 },
    rubricScores: { type: [RubricScoreSchema], default: [] },
  },
  { _id: false },
);

const ExamAttemptSchema = new Schema<ExamAttemptDoc>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
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
    answers: { type: [AnswerSchema], default: [] },
    essayAnswers: { type: [EssaySchema], default: [] },
    mcqScorePercent: { type: Number, default: null, min: 0, max: 100 },
    essayScorePercent: { type: Number, default: null, min: 0, max: 100 },
    totalScorePercent: { type: Number, default: null, min: 0, max: 100 },
    passed: { type: Boolean, default: null },
    grades: { type: [GradeSchema], default: [] },
    graderUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: { type: Date, default: null },
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

ExamAttemptSchema.index({ examId: 1, studentId: 1 });
ExamAttemptSchema.index({ studentId: 1, submittedAt: -1 });
// Grading queue: submitted but ungraded essays.
ExamAttemptSchema.index({ essayScorePercent: 1, submittedAt: 1 });

export type HydratedExamAttempt = HydratedDocument<ExamAttemptDoc>;

export const ExamAttempt =
  (mongoose.models.ExamAttempt as mongoose.Model<ExamAttemptDoc> | undefined) ??
  model<ExamAttemptDoc>('ExamAttempt', ExamAttemptSchema);
