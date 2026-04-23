import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export interface AssignmentSubmissionDoc {
  _id: Types.ObjectId;
  assignmentId: Types.ObjectId;
  courseId: Types.ObjectId;
  studentId: Types.ObjectId;
  // Student writes body text + optionally a link (Google Doc / Drive / etc).
  // Full file-upload path is gated on live Cloudinary creds and lands in a
  // follow-up; for now the URL field covers the intent at zero integration
  // cost.
  bodyText: string;
  attachmentUrl: string | null;
  submittedAt: Date;
  // Graded state.
  score: number | null;
  feedback: string | null;
  gradedByUserId: Types.ObjectId | null;
  gradedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
    score: { type: Number, default: null, min: 0 },
    feedback: { type: String, default: null, maxlength: 4000 },
    gradedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    gradedAt: { type: Date, default: null },
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

export type HydratedAssignmentSubmission = HydratedDocument<AssignmentSubmissionDoc>;

export const AssignmentSubmission =
  (mongoose.models.AssignmentSubmission as mongoose.Model<AssignmentSubmissionDoc> | undefined) ??
  mongoose.model<AssignmentSubmissionDoc>('AssignmentSubmission', AssignmentSubmissionSchema);
