import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  PROGRAM_REQUIRED_DOC_TYPES,
  type ProgramRequiredDocType,
} from 'india-learns-shared-types';

// M10k — Student documents post-conversion (LMS_Requirements §1
// "Certificate documentation"). Decoupled from the admissions
// Application: an admin can upload these against any student User
// regardless of whether they came in via the admissions funnel.
//
// `documentType` reuses the same Indian-school enum we extended in M10a
// (govid, transcript, sslc, plus_two, degree, transfer_certificate,
// passport_photo, etc.) so the same UI doc-pickers can be reused.

export interface StudentDocumentDoc {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  documentType: ProgramRequiredDocType;
  label: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedByUserId: Types.ObjectId;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentDocumentSchema = new Schema<StudentDocumentDoc>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: PROGRAM_REQUIRED_DOC_TYPES,
      required: true,
    },
    label: { type: String, required: true, maxlength: 240 },
    url: { type: String, required: true, maxlength: 1024 },
    sizeBytes: { type: Number, default: 0, min: 0 },
    mimeType: { type: String, default: 'application/octet-stream', maxlength: 128 },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: { type: Date, default: () => new Date() },
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

StudentDocumentSchema.index({ studentId: 1, documentType: 1 });

export type HydratedStudentDocument = HydratedDocument<StudentDocumentDoc>;
export const StudentDocument =
  (mongoose.models.StudentDocument as
    | mongoose.Model<StudentDocumentDoc>
    | undefined) ??
  model<StudentDocumentDoc>('StudentDocument', StudentDocumentSchema);
