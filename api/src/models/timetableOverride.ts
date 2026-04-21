import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { OverrideAction } from 'india-learns-shared-types';

export interface TimetableOverrideDoc {
  _id: Types.ObjectId;
  batchId: Types.ObjectId;
  entryId: Types.ObjectId | null;
  date: Date;
  action: OverrideAction;
  newCourseId: Types.ObjectId | null;
  newFacultyId: Types.ObjectId | null;
  newStartMinutes: number | null;
  newEndMinutes: number | null;
  newRoom: string | null;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableOverrideSchema = new Schema<TimetableOverrideDoc>(
  {
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    entryId: {
      type: Schema.Types.ObjectId,
      ref: 'TimetableEntry',
      default: null,
    },
    date: { type: Date, required: true, index: true },
    action: {
      type: String,
      enum: ['cancel', 'reschedule', 'add'],
      required: true,
    },
    newCourseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    newFacultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    newStartMinutes: { type: Number, default: null, min: 0, max: 1440 },
    newEndMinutes: { type: Number, default: null, min: 0, max: 1440 },
    newRoom: { type: String, default: null, maxlength: 80 },
    reason: { type: String, default: '', maxlength: 500 },
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

// One cancel/reschedule per (entry, date). Excludes 'add' (entryId null).
TimetableOverrideSchema.index(
  { batchId: 1, entryId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { entryId: { $type: 'objectId' } },
  },
);
TimetableOverrideSchema.index({ batchId: 1, date: 1 });

export type HydratedTimetableOverride = HydratedDocument<TimetableOverrideDoc>;

export const TimetableOverride =
  (mongoose.models.TimetableOverride as
    | mongoose.Model<TimetableOverrideDoc>
    | undefined) ??
  model<TimetableOverrideDoc>('TimetableOverride', TimetableOverrideSchema);
