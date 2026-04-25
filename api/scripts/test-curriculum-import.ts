// Smoke-test the curriculum import end-to-end against the live generator
// and live Mongo. Requires MONGODB_URI in the environment. Picks any super-
// admin user as the importer; creates a "Curriculum Import Smoke" program
// if none exists. Idempotent — re-runs replace the previous import.
//
// Usage:
//   npm run dev:smoke-import -w api -- 69bbf3cd5c4093e441e75eba
// or
//   tsx scripts/test-curriculum-import.ts <workflowId>

import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { Program, User } from '../src/models/index.js';
import {
  fetchWorkflow,
  checkGeneratorHealth,
} from '../src/services/curriculumImport/client.js';
import { transformWorkflow } from '../src/services/curriculumImport/transformer.js';
import { persistImport } from '../src/services/curriculumImport/persister.js';

const SMOKE_PROGRAM_SLUG = 'curriculum-import-smoke';

async function getOrCreateSmokeProgram(): Promise<{ id: string }> {
  const existing = await Program.findOne({ slug: SMOKE_PROGRAM_SLUG });
  if (existing) return { id: String(existing._id) };
  const created = await Program.create({
    name: 'Curriculum Import Smoke',
    slug: SMOKE_PROGRAM_SLUG,
    description: 'Holding program for end-to-end curriculum-import smoke tests.',
  });
  return { id: String(created._id) };
}

async function main(): Promise<void> {
  const workflowId = process.argv[2];
  if (!workflowId) {
    logger.fatal('usage: tsx scripts/test-curriculum-import.ts <workflowId>');
    process.exit(2);
  }
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    logger.fatal('MONGODB_URI is required');
    process.exit(2);
  }

  logger.info('checking generator health…');
  const health = await checkGeneratorHealth();
  if (!health.ok) {
    logger.fatal({ baseUrl: health.baseUrl }, 'generator unreachable');
    process.exit(3);
  }
  logger.info({ baseUrl: health.baseUrl }, 'generator OK');

  await connectDb(mongoUri);

  const superAdmin = await User.findOne({ role: 'superadmin', deletedAt: null }).select('_id email');
  if (!superAdmin) {
    logger.fatal('no super-admin in DB — run seed:superadmin first');
    await disconnectDb();
    process.exit(4);
  }

  const program = await getOrCreateSmokeProgram();
  logger.info({ programId: program.id }, 'smoke program ready');

  logger.info({ workflowId }, 'fetching workflow…');
  const wf = await fetchWorkflow(workflowId);
  logger.info(
    {
      project: wf.projectName,
      currentStep: wf.currentStep,
      status: wf.status,
    },
    'workflow fetched',
  );

  const transformed = transformWorkflow(wf);
  logger.info(
    {
      modules: transformed.modules.length,
      sessions: transformed.sessions.length,
      materials: transformed.materials.length,
      assignments: transformed.assignments.length,
      warnings: transformed.warnings.length,
    },
    'transformer done',
  );

  const result = await persistImport(transformed, {
    programId: program.id as unknown as never, // ObjectId hex — Mongoose accepts string
    importerUserId: superAdmin._id,
    replace: true,
  });

  logger.info({ courseId: String(result.courseId), created: result.created }, 'import committed');
  if (result.warnings.length > 0) {
    logger.warn({ warnings: result.warnings }, 'warnings during import');
  }

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err: err.message ?? err }, 'smoke import failed');
  try {
    await disconnectDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
