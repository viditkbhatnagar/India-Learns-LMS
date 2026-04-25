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

export interface ModuleLearningOutcomeDoc {
  mloId: string;            // e.g. "M1-LO1"
  code: string;
  statement: string;
  bloomLevel: string;
  verb: string;
  linkedPLOs: string[];
  linkedKSCs: string[];     // generator's `competencyLinks`
}

export interface ModuleDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  title: string;
  order: number;
  content: ModuleContentBlockDoc[];
  // Curriculum-generator fields (Phase A). All optional with safe defaults
  // so existing modules created before the import feature still validate.
  sourceModuleId: string | null;        // e.g. "mod1"
  code: string | null;                  // e.g. "MOD101"
  coreElective: 'core' | 'elective';    // generator has no marker; defaults to 'core'
  aim: string;                          // mapped from generator `description`
  prerequisites: string[];
  learningOutcomes: ModuleLearningOutcomeDoc[];
  totalHours: number | null;
  contactHours: number | null;
  selfStudyHours: number | null;
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

const MLOSchema = new Schema<ModuleLearningOutcomeDoc>(
  {
    mloId: { type: String, required: true },
    code: { type: String, required: true },
    statement: { type: String, required: true },
    bloomLevel: { type: String, default: '' },
    verb: { type: String, default: '' },
    linkedPLOs: { type: [String], default: [] },
    linkedKSCs: { type: [String], default: [] },
  },
  { _id: false, versionKey: false },
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
    sourceModuleId: { type: String, default: null },
    code: { type: String, default: null },
    coreElective: { type: String, enum: ['core', 'elective'], default: 'core' },
    aim: { type: String, default: '' },
    prerequisites: { type: [String], default: [] },
    learningOutcomes: { type: [MLOSchema], default: [] },
    totalHours: { type: Number, default: null },
    contactHours: { type: Number, default: null },
    selfStudyHours: { type: Number, default: null },
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
