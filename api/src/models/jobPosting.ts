import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_POSTING_STATES,
  type JobEmploymentType,
  type JobPostingState,
} from 'india-learns-shared-types';

// M10f — JobPosting (LMS_Requirements §3). Single Company → many
// JobPosting (1:N). `state='draft'` while admin/placement is curating;
// `published` makes it visible on the student-facing /jobs feed;
// `closed` removes it from the feed but keeps applications inspectable.
//
// `targetProgramIds` is the soft eligibility filter — empty array means
// "open to all programmes". Salary uses paise to match the rest of the
// fees-money convention; both bounds are nullable since placements
// frequently hide compensation until offer stage.

export interface JobPostingDoc {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  title: string;
  description: string;
  location: string;
  employmentType: JobEmploymentType;
  minSalaryPaise: number | null;
  maxSalaryPaise: number | null;
  eligibility: string;
  targetProgramIds: Types.ObjectId[];
  applicationDeadline: Date | null;
  postedByUserId: Types.ObjectId;
  state: JobPostingState;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const JobPostingSchema = new Schema<JobPostingDoc>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 8000 },
    location: { type: String, default: '', maxlength: 200 },
    employmentType: {
      type: String,
      enum: JOB_EMPLOYMENT_TYPES,
      required: true,
    },
    minSalaryPaise: { type: Number, default: null, min: 0 },
    maxSalaryPaise: { type: Number, default: null, min: 0 },
    eligibility: { type: String, default: '', maxlength: 2000 },
    targetProgramIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Program' }],
      default: [],
    },
    applicationDeadline: { type: Date, default: null },
    postedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    state: {
      type: String,
      enum: JOB_POSTING_STATES,
      default: 'draft',
      index: true,
    },
    deletedAt: { type: Date, default: null },
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

JobPostingSchema.index({ state: 1, applicationDeadline: 1 });
JobPostingSchema.index({ companyId: 1, state: 1 });

export type HydratedJobPosting = HydratedDocument<JobPostingDoc>;
export const JobPosting =
  (mongoose.models.JobPosting as mongoose.Model<JobPostingDoc> | undefined) ??
  model<JobPostingDoc>('JobPosting', JobPostingSchema);
