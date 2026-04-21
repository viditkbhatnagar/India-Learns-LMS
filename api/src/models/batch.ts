import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { BatchStatus } from 'india-learns-shared-types';

export interface BatchDoc {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
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
