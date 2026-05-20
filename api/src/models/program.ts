import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  PROGRAM_REQUIRED_DOC_TYPES,
  type AdmissionMode,
  type ProgramRequiredDocType,
} from 'india-learns-shared-types';

// M2 — Document type slot per program. The applicant uploads one file per
// slot in Step 6. Required slots block submit; conditional ones don't.
//
// M10 — `documentType` now reuses the shared `ProgramRequiredDocType`
// enum so the SSLC / Plus Two / Degree / Transfer Certificate / Passport
// Photo additions land in one place. Existing programs continue to use
// govid + transcript by default.
export interface ProgramAdmissionsDocReqDoc {
  documentType: ProgramRequiredDocType;
  label: string;
  required: boolean;
}

export interface ProgramDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  totalHours: number;
  isActive: boolean;
  // Admissions M2 — per-program admissions config. Inline on Program rather
  // than a separate `AdmissionsProgramConfig` collection to keep V1 lean
  // (plan §"Reuse audit"). Defaults match a "free, cohort-pick, gov-ID +
  // transcript only" baseline so existing LMS programs aren't disrupted
  // when an admin flips admissionsEnabled true.
  admissionsEnabled: boolean;
  admissionMode: AdmissionMode;
  applicationFeePaise: number;
  requiredDocs: ProgramAdmissionsDocReqDoc[];
  requiresStatement: boolean;
  requiresReferences: boolean;
  referencesMinCount: number;
  referencesMaxCount: number;
  statementWordLimit: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocReqSchema = new Schema<ProgramAdmissionsDocReqDoc>(
  {
    documentType: {
      type: String,
      enum: PROGRAM_REQUIRED_DOC_TYPES,
      required: true,
    },
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

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
    admissionsEnabled: { type: Boolean, default: false, index: true },
    admissionMode: {
      type: String,
      enum: ['cohort_pick', 'program_only'],
      default: 'cohort_pick',
    },
    applicationFeePaise: { type: Number, default: 0, min: 0 },
    requiredDocs: {
      type: [DocReqSchema],
      default: () => [
        { documentType: 'govid', label: 'Government ID', required: true },
        { documentType: 'transcript', label: 'Prior transcript', required: true },
      ],
    },
    requiresStatement: { type: Boolean, default: false },
    requiresReferences: { type: Boolean, default: false },
    referencesMinCount: { type: Number, default: 0, min: 0, max: 5 },
    referencesMaxCount: { type: Number, default: 2, min: 0, max: 5 },
    statementWordLimit: { type: Number, default: 1000, min: 50, max: 5000 },
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
ProgramSchema.index({ admissionsEnabled: 1, isActive: 1 });

export type HydratedProgram = HydratedDocument<ProgramDoc>;

export const Program =
  (mongoose.models.Program as mongoose.Model<ProgramDoc> | undefined) ??
  model<ProgramDoc>('Program', ProgramSchema);
