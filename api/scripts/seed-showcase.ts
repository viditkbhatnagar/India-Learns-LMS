/**
 * Ingest the India Learns showcase collateral (company profile + program
 * brochures) into GridFS and index them in the `showcasedocuments`
 * collection so the staff Showcase section can present them in-app.
 *
 *   npm run seed:showcase -w api                 # ingest missing / new docs
 *   SHOWCASE_RESET=1 npm run seed:showcase -w api   # re-upload every doc
 *
 * The PDFs are large (tens of MB) and are gitignored — point the script at
 * wherever they live with SHOWCASE_DIR (defaults to the repo root):
 *   SHOWCASE_DIR=/path/to/pdfs npm run seed:showcase -w api
 *
 * Bytes are written straight into the shared `il_files` GridFS bucket via
 * MongoStorageAdapter (NOT getIntegrations().storage — that is the in-memory
 * stub in local dev). The bytes are then served by the staff-gated
 * GET /v1/showcase/:id/file, which resolves GridFS server-side. This works
 * regardless of STORAGE_PROVIDER (mongo today, and still via the GridFS
 * fallback even if prod is later flipped to s3), so run it against whichever
 * database you want populated (local dev, then prod Atlas) — same operational
 * pattern as seed:entrance.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { ShowcaseCategory } from 'india-learns-shared-types';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  MongoStorageAdapter,
  gridfsFileExists,
} from '../src/integrations/mongoStorageAdapter.js';
import {
  findShowcaseDocumentBySlug,
  upsertShowcaseDocumentBySlug,
} from '../src/services/showcaseService.js';

interface ShowcaseSeed {
  slug: string;
  title: string;
  description: string;
  category: ShowcaseCategory;
  filename: string;
  order: number;
}

// The three approved marketing PDFs the client added to the repo root.
// Filenames are matched exactly (spaces / punctuation included).
const DOCS: ShowcaseSeed[] = [
  {
    slug: 'india-learns-profile',
    title: 'India Learns — Company Profile',
    description:
      'The India Learns institutional profile: who we are, our programs, campus and approach. Present this to prospective students and visitors.',
    category: 'profile',
    filename: 'INDIA LEARNS PROFILE FINALLLL.pdf',
    order: 0,
  },
  {
    slug: 'diploma-fashion-design-retail',
    title: 'Diploma in Fashion Design & Retail Management',
    description:
      'Program brochure for the Diploma in Fashion Design & Retail Management — curriculum, outcomes and highlights.',
    category: 'program',
    filename: 'INDIA LEARNS DIPLOMA IN FASHION DESIGN & RETAIL MANAGEMENT.pdf',
    order: 1,
  },
  {
    slug: 'diploma-digital-fashion-entrepreneurship',
    title: 'Diploma in Digital Fashion Entrepreneurship',
    description:
      'Program brochure for the Diploma in Digital Fashion Entrepreneurship — curriculum, outcomes and highlights.',
    category: 'program',
    filename: 'DIPLOMA IN DIGITAL FASHION ENTREPRENEURSHIP.pdf',
    order: 2,
  },
];

const SeedEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required for seeding.'),
  SHOWCASE_RESET: z.string().optional(),
  SHOWCASE_DIR: z.string().optional(),
});

type IngestOutcome =
  | { kind: 'skipped'; slug: string; note: string }
  | { kind: 'missing'; slug: string; filePath: string }
  | { kind: 'created' | 'updated'; slug: string; mb: number };

async function ingestOne(
  d: ShowcaseSeed,
  dir: string,
  reset: boolean,
  storage: MongoStorageAdapter,
): Promise<IngestOutcome> {
  const filePath = path.join(dir, d.filename);
  const existing = await findShowcaseDocumentBySlug(d.slug);
  const oldFileId = existing?.fileId ?? null;
  const bytesPresent = oldFileId ? await gridfsFileExists(oldFileId) : false;

  // Nothing to do: doc exists, bytes are in GridFS, and we're not resetting.
  if (existing && bytesPresent && !reset) {
    return { kind: 'skipped', slug: d.slug, note: 'already ingested' };
  }
  // Can't (re)ingest without the file. Keep any existing doc untouched.
  if (!existsSync(filePath)) {
    return { kind: 'missing', slug: d.slug, filePath };
  }

  const bytes = readFileSync(filePath);
  const sizeBytes = statSync(filePath).size;

  // Non-destructive order: (1) upload new bytes, (2) repoint the doc to the
  // new fileId, (3) only then delete the old bytes. A mid-run failure never
  // leaves the doc pointing at a deleted file (at worst it orphans the newly
  // uploaded bytes, which a later re-run replaces).
  const { key } = await storage.upload({
    bytes,
    filename: d.filename,
    folder: 'showcase',
    contentType: 'application/pdf',
  });

  const { created } = await upsertShowcaseDocumentBySlug({
    slug: d.slug,
    title: d.title,
    description: d.description,
    category: d.category,
    fileId: key,
    contentType: 'application/pdf',
    sizeBytes,
    originalFilename: d.filename,
    order: d.order,
  });

  if (oldFileId && oldFileId !== key) {
    await storage.delete(oldFileId);
  }

  return { kind: created ? 'created' : 'updated', slug: d.slug, mb: Math.round(sizeBytes / 1024 / 1024) };
}

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'showcase seed env invalid');
    process.exit(2);
  }
  const env = parsed.data;
  const reset = env.SHOWCASE_RESET === '1' || env.SHOWCASE_RESET === 'true';
  const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const dir = env.SHOWCASE_DIR ? path.resolve(env.SHOWCASE_DIR) : repoRoot;

  await connectDb(env.MONGODB_URI);
  const storage = new MongoStorageAdapter();

  const outcomes: IngestOutcome[] = [];
  for (const d of DOCS) {
    // Sequential on purpose: 55 MB reads + GridFS writes, one at a time.
    outcomes.push(await ingestOne(d, dir, reset, storage));
  }

  const summary = {
    created: outcomes.filter((o) => o.kind === 'created').map((o) => `${o.slug} (${'mb' in o ? o.mb : 0} MB)`),
    updated: outcomes.filter((o) => o.kind === 'updated').map((o) => `${o.slug} (${'mb' in o ? o.mb : 0} MB)`),
    skipped: outcomes.filter((o) => o.kind === 'skipped').map((o) => o.slug),
    missing: outcomes
      .filter((o): o is Extract<IngestOutcome, { kind: 'missing' }> => o.kind === 'missing')
      .map((o) => `${o.slug} → ${o.filePath}`),
  };

  logger.info(summary, 'showcase seed complete');
  if (summary.missing.length > 0) {
    logger.warn(
      { missing: summary.missing, dir },
      'showcase: some PDFs were not found on disk — set SHOWCASE_DIR to their folder and re-run',
    );
  }
  console.log('\n=== Showcase seed ===');
  console.log(summary);

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'showcase seed failed');
  try {
    await disconnectDb();
  } catch {
    // noop
  }
  process.exit(1);
});
