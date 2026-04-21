import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { ModuleContentKind } from 'india-learns-shared-types';

export interface ModuleContentBlockDoc {
  _id: Types.ObjectId;
  kind: ModuleContentKind;
  title: string;
  videoUrl: string | null;
  pdfUrl: string | null;
  pdfStorageKey: string | null;
  allowDownload: boolean;
  textMarkdown: string | null;
  quizId: Types.ObjectId | null;
}

export interface ModuleDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  order: number;
  content: ModuleContentBlockDoc[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleContentSchema = new Schema<ModuleContentBlockDoc>(
  {
    kind: {
      type: String,
      enum: ['video', 'pdf', 'text', 'quizRef'],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    videoUrl: { type: String, default: null },
    pdfUrl: { type: String, default: null },
    pdfStorageKey: { type: String, default: null },
    allowDownload: { type: Boolean, default: false },
    textMarkdown: { type: String, default: null },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', default: null },
  },
  { _id: true, versionKey: false },
);

const ModuleSchema = new Schema<ModuleDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    order: { type: Number, required: true, min: 0 },
    content: { type: [ModuleContentSchema], default: [] },
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

// A module's order is unique within its course only while the module is alive.
ModuleSchema.index(
  { courseId: 1, order: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export type HydratedModule = HydratedDocument<ModuleDoc>;

export const ModuleModel =
  (mongoose.models.Module as mongoose.Model<ModuleDoc> | undefined) ??
  model<ModuleDoc>('Module', ModuleSchema);
