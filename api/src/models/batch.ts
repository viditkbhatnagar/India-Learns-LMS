import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { BatchStatus } from 'india-learns-shared-types';

export interface BatchDoc {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  // Admissions M2 — seatsRemaining is the source of truth for the
  // cohort-capacity race-gate at admit time (M7). Defaults to `capacity` on
  // create; decremented atomically when an applicant accepts an offer and
  // incremented when they decline. The two-source-of-truth (capacity +
  // seatsRemaining) is intentional: capacity is the cohort's design size and
  // doesn't change; seatsRemaining tracks live availability.
  seatsRemaining: number;
  // True when the admissions module should accept new applications targeting
  // this batch. Separate from `status` because admissions-readiness and
  // program-delivery state are different concerns (plan §M2).
  openForApplications: boolean;
  status: BatchStatus;
  coordinators: Types.ObjectId[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<BatchDoc>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    capacity: { type: Number, default: 30, min: 1 },
    seatsRemaining: { type: Number, default: 30, min: 0 },
    openForApplications: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['planned', 'active', 'completed', 'archived'],
      default: 'planned',
      index: true,
    },
    coordinators: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
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

BatchSchema.index({ programId: 1, status: 1 });
BatchSchema.index({ startDate: 1 });

export type HydratedBatch = HydratedDocument<BatchDoc>;

export const Batch =
  (mongoose.models.Batch as mongoose.Model<BatchDoc> | undefined) ??
  model<BatchDoc>('Batch', BatchSchema);
