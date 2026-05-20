import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  JOB_APPLICATION_STATUSES,
  type JobApplicationStatus,
} from 'india-learns-shared-types';

// M10f — JobApplication (LMS_Requirements §3). One row per (student,
// posting) pair; the unique compound index below makes apply idempotent
// — calling apply again returns the existing row instead of duplicating.
//
// `resumeUrl` is a snapshot of `User.resumeUrl` at apply time so the
// placement team always sees the resume the student actually applied
// with (later profile edits don't retroactively rewrite the history).

export interface JobApplicationDoc {
  _id: Types.ObjectId;
  jobPostingId: Types.ObjectId;
  studentId: Types.ObjectId;
  resumeUrl: string | null;
  coverNote: string;
  status: JobApplicationStatus;
  interviewNote: string | null;
  // M10l — Structured interview scheduling (LMS_Requirements §3
  // "Interview status"). Set by the placement team when status flips
  // to 'interview_scheduled'.
  interviewAt: Date | null;
  interviewLocation: string | null;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobApplicationSchema = new Schema<JobApplicationDoc>(
  {
    jobPostingId: {
      type: Schema.Types.ObjectId,
      ref: 'JobPosting',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumeUrl: { type: String, default: null, maxlength: 1024 },
    coverNote: { type: String, default: '', maxlength: 4000 },
    status: {
      type: String,
      enum: JOB_APPLICATION_STATUSES,
      default: 'applied',
      index: true,
    },
    interviewNote: { type: String, default: null, maxlength: 2000 },
    interviewAt: { type: Date, default: null },
    interviewLocation: { type: String, default: null, maxlength: 240 },
    appliedAt: { type: Date, default: () => new Date() },
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

// One application per (student, posting). Used both for the
// `applied|withdrawn` flip and to dedup the apply call.
JobApplicationSchema.index(
  { jobPostingId: 1, studentId: 1 },
  { unique: true },
);
JobApplicationSchema.index({ studentId: 1, status: 1 });

export type HydratedJobApplication = HydratedDocument<JobApplicationDoc>;
export const JobApplication =
  (mongoose.models.JobApplication as
    | mongoose.Model<JobApplicationDoc>
    | undefined) ??
  model<JobApplicationDoc>('JobApplication', JobApplicationSchema);
