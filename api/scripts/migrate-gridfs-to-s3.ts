import { z } from 'zod';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { runGridfsToS3Migration } from '../src/services/migrateGridfsToS3.js';

// One-shot migration from GridFS (`il_files`) to AWS S3.
//
// Each GridFS file becomes an S3 object at `<folder>/<id>` plus a
// matching FileMeta document with the original ObjectId — so every
// stored `/v1/files/<id>` URL keeps resolving after the cutover.
//
// Flags:
//   --dry-run   List what would be migrated; touch nothing.
//   --keep      Migrate to S3 + write FileMeta, but DO NOT delete the
//               GridFS file. Default deletes after a verified upload.
//
// Run:
//   npm run migrate:gridfs-to-s3 -w api -- [--dry-run] [--keep]

const MigrateEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required.'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required.'),
  AWS_SECRET_ACCESS_KEY: z
    .string()
    .min(1, 'AWS_SECRET_ACCESS_KEY is required.'),
  AWS_S3_ENDPOINT: z.string().optional().default(''),
});

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const keepGridfs = argv.includes('--keep');

  const parsed = MigrateEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal(
      { issues: parsed.error.flatten().fieldErrors },
      'migrate env invalid',
    );
    process.exit(2);
  }
  const env = parsed.data;

  await connectDb(env.MONGODB_URI);
  try {
    const summary = await runGridfsToS3Migration({
      s3Bucket: env.AWS_S3_BUCKET,
      s3Region: env.AWS_REGION,
      awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      awsEndpoint: env.AWS_S3_ENDPOINT || undefined,
      dryRun,
      keepGridfs,
    });
    await disconnectDb();
    if (summary.failed > 0) process.exit(1);
  } catch (err) {
    logger.fatal({ err: (err as Error).message }, 'migration crashed');
    await disconnectDb();
    process.exit(1);
  }
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
