import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  EnrollmentAccessState,
  EnrollmentStatus,
} from 'india-learns-shared-types';

export interface EnrollmentDoc {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  batchId: Types.ObjectId;
  courseId: Types.ObjectId;
  programId: Types.ObjectId;
  validFrom: Date;
  validTo: Date;
  status: EnrollmentStatus;
  accessState: EnrollmentAccessState;
  completed: boolean;
  completedAt: Date | null;
  certificateUrl: string | null;
  certificateIssuedAt: Date | null;
  certificateProviderId: string | null;
  certificateIssueError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<EnrollmentDoc>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },
    accessState: {
      type: String,
      enum: ['active', 'warn1', 'warn2', 'override', 'suspended'],
      default: 'active',
    },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    certificateUrl: { type: String, default: null },
    certificateIssuedAt: { type: Date, default: null },
    certificateProviderId: { type: String, default: null },
    certificateIssueError: { type: String, default: null, maxlength: 500 },
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

// PRD §7.2 — at most one active enrolment per (student, course).
EnrollmentSchema.index(
  { studentId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
EnrollmentSchema.index({ studentId: 1, status: 1 });
EnrollmentSchema.index({ batchId: 1, courseId: 1 });

export type HydratedEnrollment = HydratedDocument<EnrollmentDoc>;

export const Enrollment =
  (mongoose.models.Enrollment as mongoose.Model<EnrollmentDoc> | undefined) ??
  model<EnrollmentDoc>('Enrollment', EnrollmentSchema);
