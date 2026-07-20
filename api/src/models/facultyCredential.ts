import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// Admin-recoverable faculty password, stored ENCRYPTED at rest (AES-256-GCM
// via utils/secretBox). Kept in its own collection — deliberately NOT on the
// User doc — so normal user queries / DTOs can never leak it. Only the
// staff-gated faculty-account endpoints decrypt it.
//
// One row per faculty user (userId unique). `secret` is the sealed string
// from secretBox.seal(); never store or log the plaintext.

export interface FacultyCredentialDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  secret: string;
  createdAt: Date;
  updatedAt: Date;
}

const FacultyCredentialSchema = new Schema<FacultyCredentialDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    secret: { type: String, required: true, maxlength: 1024 },
  },
  {
    timestamps: true,
    // No toJSON transform that exposes `secret` — this doc is never returned
    // to clients directly; the service decrypts and maps to FacultyAccountDto.
  },
);

export type HydratedFacultyCredential = HydratedDocument<FacultyCredentialDoc>;

export const FacultyCredential =
  (mongoose.models.FacultyCredential as mongoose.Model<FacultyCredentialDoc> | undefined) ??
  model<FacultyCredentialDoc>('FacultyCredential', FacultyCredentialSchema);
