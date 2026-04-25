import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

// AssignmentSubmission state machine (Phase B-1):
//
//   submitted → needs_grading → graded_draft → published
//                                  ↑       ↘
//                           (re-edit)   (publish)
//
// `not_started` and `in_progress` are NEVER stored — they are computed at
// read time when no submission row exists for (assignment, student) yet.
// `missing` is also computed (status=not_started AND now > dueAt).
//
// `graded_draft` is faculty-visible only; the API layer must strip score
// / feedback / rubricScores from any response sent to a student until the
// status flips to `published`.
export const SUBMISSION_STATUSES = [
  'submitted',
  'needs_grading',
  'graded_draft',
  'published',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface SubmissionRubricScoreDoc {
  criterionIndex: number;
  score: number;
  comment: string;
}

export interface AssignmentSubmissionDoc {
  _id: Types.ObjectId;
  assignmentId: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  bodyText: string;
  attachmentUrl: string | null;
  submittedAt: Date;
  // State machine — see top of file.
  status: SubmissionStatus;
  // True when submittedAt > assignment.dueAt at the moment of submission.
  // Default policy (OPEN-QUESTIONS.md): flagged but no auto-deduction.
  lateFlag: boolean;
  // Numeric grade. Mirrors faculty's overall score; populated on draft, not
  // changed on publish. Faculty re-edits a draft by sending a new draft
  // payload — score/feedback/rubricScores are replaced wholesale.
  score: number | null;
  feedback: string | null;
  rubricScores: SubmissionRubricScoreDoc[];
  gradedByUserId: Types.ObjectId | null;
  gradedAt: Date | null;
  // Set on publish only. Stays set across re-publish (we always advance).
  // Cleared on student re-submission (which resets the row to 'submitted').
  publishedByUserId: Types.ObjectId | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RubricScoreSchema = new Schema<SubmissionRubricScoreDoc>(
  {
    criterionIndex: { type: Number, required: true, min: 0 },
    score: { type: Number, required: true, min: 0 },
    comment: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false, versionKey: false },
);

const AssignmentSubmissionSchema = new Schema<AssignmentSubmissionDoc>(
  {
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bodyText: { type: String, default: '', maxlength: 16_000 },
    attachmentUrl: { type: String, default: null, maxlength: 2048 },
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: 'submitted',
      index: true,
    },
    lateFlag: { type: Boolean, default: false, index: true },
    score: { type: Number, default: null, min: 0 },
    feedback: { type: String, default: null, maxlength: 4000 },
    rubricScores: { type: [RubricScoreSchema], default: [] },
    gradedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: { type: Date, default: null },
    publishedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

// One submission per (assignment, student). Upsert on re-submit.
AssignmentSubmissionSchema.index(
  { assignmentId: 1, studentId: 1 },
  { unique: true },
);
// Gradebook grid lookup: cells indexed by (course, status) for fast filtering.
AssignmentSubmissionSchema.index({ courseId: 1, status: 1 });

export type HydratedAssignmentSubmission = HydratedDocument<AssignmentSubmissionDoc>;

export const AssignmentSubmission =
  (mongoose.models.AssignmentSubmission as mongoose.Model<AssignmentSubmissionDoc> | undefined) ??
  mongoose.model<AssignmentSubmissionDoc>('AssignmentSubmission', AssignmentSubmissionSchema);
