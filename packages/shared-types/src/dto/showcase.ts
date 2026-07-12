import type { ShowcaseCategory } from '../enums.js';

// Showcase documents — marketing collateral (India Learns company profile +
// program brochures) that Admin / Superadmin / Faculty present in-app from
// the Showcase section. The bytes live in GridFS (the same `il_files` bucket
// as every other file) and are streamed back through the STAFF-gated
// `GET /v1/showcase/:id/file` route (keyed by this document `id`). The raw
// GridFS `fileId` is intentionally NOT exposed to the client, so students can
// never reach the bytes via the un-role-gated `/v1/files/:id` proxy. Ingested
// by `npm run seed:showcase -w api`, not the 5 MB HTTP upload route.
export interface ShowcaseDocumentDto {
  id: string;
  /** Stable human-readable key (`india-learns-profile`) — the seed upserts by this. */
  slug: string;
  title: string;
  description: string;
  category: ShowcaseCategory;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  /** Sort order in the section (ascending). */
  order: number;
  updatedAt: string;
}
