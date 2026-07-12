import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { SHOWCASE_CATEGORIES, type ShowcaseCategory } from 'india-learns-shared-types';

// Showcase documents — marketing collateral (India Learns company profile +
// program brochures) that Admin / Superadmin / Faculty present in-app from
// the Showcase section.
//
// The PDF bytes live in GridFS (`il_files`) like every other file; `fileId`
// is that GridFS `_id`, streamed back through the auth-gated
// `GET /v1/files/:fileId` proxy. These files are large (tens of MB) and are
// ingested by `scripts/seed-showcase.ts` — never through the 5 MB HTTP
// upload route. This collection is just the small index the section lists.

export interface ShowcaseDocumentDoc {
  _id: Types.ObjectId;
  // Stable human-readable key the seed upserts by (e.g. `india-learns-profile`).
  slug: string;
  title: string;
  description: string;
  category: ShowcaseCategory;
  // 24-char GridFS file id → GET /v1/files/:fileId.
  fileId: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  // Ascending display order within the section.
  order: number;
  // Soft on/off toggle so a doc can be hidden without deleting its bytes.
  active: boolean;
  // Staff user who ingested it (seed runs may leave this null).
  uploadedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ShowcaseDocumentSchema = new Schema<ShowcaseDocumentDoc>(
  {
    slug: { type: String, required: true, unique: true, maxlength: 120 },
    title: { type: String, required: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 2000 },
    category: {
      type: String,
      enum: SHOWCASE_CATEGORIES,
      required: true,
      default: 'other',
    },
    fileId: { type: String, required: true, maxlength: 64 },
    contentType: { type: String, default: 'application/pdf', maxlength: 200 },
    sizeBytes: { type: Number, default: 0 },
    originalFilename: { type: String, default: '', maxlength: 400 },
    // Ordering/active are served by the compound index below — no standalone
    // single-field indexes needed.
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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

// The section lists active docs ordered by `order` then newest-first.
ShowcaseDocumentSchema.index({ active: 1, order: 1, createdAt: -1 });

export type HydratedShowcaseDocument = HydratedDocument<ShowcaseDocumentDoc>;

export const ShowcaseDocument =
  (mongoose.models.ShowcaseDocument as mongoose.Model<ShowcaseDocumentDoc> | undefined) ??
  model<ShowcaseDocumentDoc>('ShowcaseDocument', ShowcaseDocumentSchema);
