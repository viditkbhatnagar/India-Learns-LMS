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
  /**
   * Phase-2 (PR #16) — faculty-private notes scoped to the module.
   * Surfaced only on staff-side endpoints; never serialised to students.
   * Free-text, capped at 8000 chars to mirror Session.notes.
   */
  facultyNotes: string;
  /**
   * PR #18 (UAT r5) — student-facing module syllabus. Long-form text
   * (Logan asked for "space for the syllabus to each module"). 16000
   * char cap matches the assignment instructions / submission body
   * caps elsewhere — plenty of room for a multi-paragraph syllabus.
   */
  syllabus: string;
  /**
   * Optional uploaded syllabus document (PDF/DOCX/etc.). Bytes live in
   * S3 via the FileMeta indirection — fileId IS the FileMeta._id so the
   * student-facing download URL is the existing `/v1/files/:fileId`
   * proxy route. Filename/contentType/size are denormalised so the
   * student view renders the link without an extra lookup.
   */
  syllabusFile: ModuleSyllabusFileDoc | null;
  // Module-level, faculty-managed, student-visible (Logan request —
  // "make it both course and module wise").
  glossary: ModuleGlossaryEntryDoc[];
  readingList: ModuleReadingItemDoc[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuleSyllabusFileDoc {
  fileId: Types.ObjectId;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
  uploadedByUserId: Types.ObjectId | null;
}

export interface ModuleGlossaryEntryDoc {
  term: string;
  definition: string;
}

export interface ModuleReadingItemDoc {
  title: string;
  author: string;
  url: string;
  note: string;
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

const SyllabusFileSchema = new Schema<ModuleSyllabusFileDoc>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: 'FileMeta', required: true },
    filename: { type: String, required: true, maxlength: 255 },
    contentType: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, default: () => new Date() },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false, versionKey: false },
);

const ModuleGlossarySchema = new Schema<ModuleGlossaryEntryDoc>(
  {
    term: { type: String, required: true, maxlength: 200 },
    definition: { type: String, required: true, maxlength: 4000 },
  },
  { _id: false, versionKey: false },
);

const ModuleReadingItemSchema = new Schema<ModuleReadingItemDoc>(
  {
    title: { type: String, required: true, maxlength: 400 },
    author: { type: String, default: '', maxlength: 200 },
    url: { type: String, default: '', maxlength: 2048 },
    note: { type: String, default: '', maxlength: 1000 },
  },
  { _id: false, versionKey: false },
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
    facultyNotes: { type: String, default: '', maxlength: 8000 },
    syllabus: { type: String, default: '', maxlength: 16_000 },
    syllabusFile: { type: SyllabusFileSchema, default: null },
    glossary: { type: [ModuleGlossarySchema], default: [] },
    readingList: { type: [ModuleReadingItemSchema], default: [] },
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
