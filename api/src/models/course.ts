import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { CourseState } from 'india-learns-shared-types';

export interface CourseDoc {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  name: string;
  slug: string;
  summary: string;
  state: CourseState;
  publishedAt: Date | null;
  publishedVersion: number;
  sequential: boolean;
  certificateTemplateId: string | null;
  facultyIds: Types.ObjectId[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<CourseDoc>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    summary: { type: String, default: '' },
    state: {
      type: String,
      enum: ['sandbox', 'published'],
      default: 'sandbox',
      index: true,
    },
    publishedAt: { type: Date, default: null },
    publishedVersion: { type: Number, default: 0 },
    sequential: { type: Boolean, default: false },
    certificateTemplateId: { type: String, default: null },
    facultyIds: {
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

CourseSchema.index({ programId: 1, slug: 1 }, { unique: true });
CourseSchema.index({ state: 1, programId: 1 });
CourseSchema.index({ facultyIds: 1 });

export type HydratedCourse = HydratedDocument<CourseDoc>;

export const Course =
  (mongoose.models.Course as mongoose.Model<CourseDoc> | undefined) ??
  model<CourseDoc>('Course', CourseSchema);
