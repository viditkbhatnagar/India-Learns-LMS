import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface TimetableEntryDoc {
  _id: Types.ObjectId;
  batchId: Types.ObjectId;
  courseId: Types.ObjectId;
  facultyId: Types.ObjectId;
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  room: string;
  notes: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableEntrySchema = new Schema<TimetableEntryDoc>(
  {
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
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTimeMinutes: { type: Number, required: true, min: 0, max: 1440 },
    endTimeMinutes: { type: Number, required: true, min: 0, max: 1440 },
    room: { type: String, default: '', trim: true, maxlength: 80 },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
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

TimetableEntrySchema.index({ batchId: 1, dayOfWeek: 1, startTimeMinutes: 1 });
TimetableEntrySchema.index({ facultyId: 1, dayOfWeek: 1 });

export type HydratedTimetableEntry = HydratedDocument<TimetableEntryDoc>;

export const TimetableEntry =
  (mongoose.models.TimetableEntry as mongoose.Model<TimetableEntryDoc> | undefined) ??
  model<TimetableEntryDoc>('TimetableEntry', TimetableEntrySchema);
