import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M3a — Files uploaded by the applicant (Step 6) and by referees (M3b).
// Stored in Cloudinary; this doc holds the application-side metadata + a
// pointer to the storage key/URL. Files are private (Cloudinary
// `authenticated` mode); the officer view fetches a signed URL on demand.

export const APPLICATION_DOCUMENT_TYPES = [
  'govid',
  'transcript',
  'resume',
  'portfolio',
  'test_score',
  'other',
  'referee_letter',
] as const;
export type ApplicationDocumentType = (typeof APPLICATION_DOCUMENT_TYPES)[number];

export interface ApplicationDocumentDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  documentType: ApplicationDocumentType;
  label: string;
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: Date;
  // 'applicant' for the Step-6 uploads; 'referee' for the M3b tokenized
  // upload flow. We don't store applicant userId for referee-uploaded docs
  // since the referee isn't a User — applicantUserId stays the same (the
  // owner of the application).
  uploadedByRole: 'applicant' | 'referee';
  refereeId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationDocumentSchema = new Schema<ApplicationDocumentDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: APPLICATION_DOCUMENT_TYPES,
      required: true,
    },
    label: { type: String, required: true },
    url: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
    uploadedByRole: {
      type: String,
      enum: ['applicant', 'referee'],
      default: 'applicant',
    },
    refereeId: {
      type: Schema.Types.ObjectId,
      ref: 'Referee',
      default: null,
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

ApplicationDocumentSchema.index({ applicationId: 1, documentType: 1 });

export type HydratedApplicationDocument = HydratedDocument<ApplicationDocumentDoc>;

export const ApplicationDocument =
  (mongoose.models.ApplicationDocument as
    | mongoose.Model<ApplicationDocumentDoc>
    | undefined) ??
  model<ApplicationDocumentDoc>('ApplicationDocument', ApplicationDocumentSchema);
