import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M10f — Placement / Jobs (LMS_Requirements §3).
//
// Companies that post jobs to India Learns students. The slug is unique
// + URL-safe so admin paths like /admin/placement/companies/:slug work
// cleanly; soft-delete via deletedAt so we can keep historical job
// postings + applications visible to the admin even when a company is
// retired from the directory.

export interface CompanyDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  industry: string | null;
  hqLocation: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<CompanyDoc>(
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
    description: { type: String, default: '', maxlength: 4000 },
    website: { type: String, default: null, maxlength: 500 },
    contactEmail: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    contactPhone: { type: String, default: null, maxlength: 32 },
    industry: { type: String, default: null, maxlength: 120 },
    hqLocation: { type: String, default: null, maxlength: 200 },
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

CompanySchema.index({ deletedAt: 1, name: 1 });

export type HydratedCompany = HydratedDocument<CompanyDoc>;
export const Company =
  (mongoose.models.Company as mongoose.Model<CompanyDoc> | undefined) ??
  model<CompanyDoc>('Company', CompanySchema);
