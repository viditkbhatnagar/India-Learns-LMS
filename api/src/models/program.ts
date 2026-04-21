import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ProgramDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  totalHours: number;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProgramSchema = new Schema<ProgramDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    description: { type: String, default: '' },
    totalHours: { type: Number, default: 300, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
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

ProgramSchema.index({ isActive: 1, name: 1 });

export type HydratedProgram = HydratedDocument<ProgramDoc>;

export const Program =
  (mongoose.models.Program as mongoose.Model<ProgramDoc> | undefined) ??
  model<ProgramDoc>('Program', ProgramSchema);
