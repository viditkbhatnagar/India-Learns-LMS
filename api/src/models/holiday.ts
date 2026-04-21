import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { HolidayKind } from 'india-learns-shared-types';

export interface HolidayDoc {
  _id: Types.ObjectId;
  date: Date;
  name: string;
  kind: HolidayKind;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<HolidayDoc>(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    kind: {
      type: String,
      enum: ['public', 'institutional'],
      default: 'public',
    },
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

HolidaySchema.index({ date: 1 }, { unique: true });

export type HydratedHoliday = HydratedDocument<HolidayDoc>;

export const Holiday =
  (mongoose.models.Holiday as mongoose.Model<HolidayDoc> | undefined) ??
  model<HolidayDoc>('Holiday', HolidaySchema);
