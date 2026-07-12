import mongoose from 'mongoose';
import type { ShowcaseCategory, ShowcaseDocumentDto } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  ShowcaseDocument,
  type HydratedShowcaseDocument,
} from '../models/showcaseDocument.js';

// Showcase documents — read side (section listing) + the upsert/delete
// helpers the seed script uses to ingest the marketing PDFs. There are no
// staff-facing writes: the section is view-only, bytes are ingested by
// `scripts/seed-showcase.ts`.

export function toShowcaseDocumentDto(doc: HydratedShowcaseDocument): ShowcaseDocumentDto {
  // Note: `fileId` (the GridFS id) is deliberately NOT surfaced — bytes are
  // fetched via the staff-gated GET /v1/showcase/:id/file, keyed by `id`.
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    originalFilename: doc.originalFilename,
    order: doc.order,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Active showcase docs, ordered for display (order asc, then newest first). */
export async function listActiveShowcaseDocuments(): Promise<HydratedShowcaseDocument[]> {
  return ShowcaseDocument.find({ active: true }).sort({ order: 1, createdAt: -1 }).exec();
}

/** A single active showcase doc by id, or 404. */
export async function findActiveShowcaseDocumentById(
  id: string,
): Promise<HydratedShowcaseDocument> {
  // Guard invalid ObjectId strings so a bad `:id` is a clean 404, not a
  // Mongoose CastError → 500.
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Showcase document not found.');
  }
  const doc = await ShowcaseDocument.findOne({ _id: id, active: true }).exec();
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'Showcase document not found.');
  }
  return doc;
}

export interface UpsertShowcaseInput {
  slug: string;
  title: string;
  description: string;
  category: ShowcaseCategory;
  fileId: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  order: number;
}

/**
 * Upsert a showcase doc by its stable slug (used by the seed). Returns the
 * document and whether it was newly created.
 */
export async function upsertShowcaseDocumentBySlug(
  input: UpsertShowcaseInput,
): Promise<{ doc: HydratedShowcaseDocument; created: boolean }> {
  const existing = await ShowcaseDocument.findOne({ slug: input.slug }).exec();
  if (existing) {
    existing.title = input.title;
    existing.description = input.description;
    existing.category = input.category;
    existing.fileId = input.fileId;
    existing.contentType = input.contentType;
    existing.sizeBytes = input.sizeBytes;
    existing.originalFilename = input.originalFilename;
    existing.order = input.order;
    existing.active = true;
    await existing.save();
    return { doc: existing, created: false };
  }
  const doc = await ShowcaseDocument.create({ ...input, active: true });
  return { doc, created: true };
}

export async function findShowcaseDocumentBySlug(
  slug: string,
): Promise<HydratedShowcaseDocument | null> {
  return ShowcaseDocument.findOne({ slug }).exec();
}
