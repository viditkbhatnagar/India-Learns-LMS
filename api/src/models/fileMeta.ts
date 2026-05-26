import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import type { StorageFolder } from 'india-learns-shared-types';
import { STORAGE_FOLDERS } from 'india-learns-shared-types';

// Metadata index for files whose bytes live in S3. The S3 object key is
// `<folder>/<_id-hex>`; the `_id` here is also what appears in the public
// `/v1/files/:id` URL — that way the URL contract survives migration
// from GridFS (we reuse the original GridFS ObjectId as the FileMeta _id).
export interface FileMetaDoc {
  _id: Types.ObjectId;
  folder: StorageFolder;
  s3Bucket: string;
  s3Key: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedByUserId: Types.ObjectId | null;
  migratedFromGridfs: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const FileMetaSchema = new Schema<FileMetaDoc>(
  {
    folder: {
      type: String,
      enum: STORAGE_FOLDERS,
      required: true,
      index: true,
    },
    s3Bucket: { type: String, required: true },
    s3Key: { type: String, required: true, unique: true },
    filename: { type: String, required: true, maxlength: 255 },
    contentType: { type: String, required: true, maxlength: 200 },
    size: { type: Number, required: true, min: 0 },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    migratedFromGridfs: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

export type HydratedFileMeta = HydratedDocument<FileMetaDoc>;

export const FileMeta =
  (mongoose.models.FileMeta as mongoose.Model<FileMetaDoc>) ||
  mongoose.model<FileMetaDoc>('FileMeta', FileMetaSchema);
