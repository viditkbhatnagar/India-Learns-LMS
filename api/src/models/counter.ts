import mongoose, { Schema, model, type Types } from 'mongoose';

export interface CounterDoc {
  _id: Types.ObjectId;
  key: string;
  seq: number;
}

const CounterSchema = new Schema<CounterDoc>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Counter =
  (mongoose.models.Counter as mongoose.Model<CounterDoc> | undefined) ??
  model<CounterDoc>('Counter', CounterSchema);
