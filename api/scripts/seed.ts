import { z } from 'zod';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { Program } from '../src/models/index.js';

const SeedEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required for seeding.'),
});

const PROGRAMS = [
  {
    slug: 'aviation-diploma',
    name: 'Aviation Diploma',
    description: 'LUC 300-hour in-person Aviation Diploma.',
    totalHours: 300,
    isActive: true,
  },
  {
    slug: 'retail-fashion-diploma',
    name: 'Retail & Fashion Diploma',
    description: 'LUC 300-hour in-person Retail & Fashion Diploma.',
    totalHours: 300,
    isActive: true,
  },
];

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'seed env invalid');
    process.exit(2);
  }

  await connectDb(parsed.data.MONGODB_URI);

  const results = await Promise.all(
    PROGRAMS.map(async (p) => {
      const res = await Program.updateOne(
        { slug: p.slug },
        { $setOnInsert: p },
        { upsert: true },
      );
      return {
        slug: p.slug,
        inserted: res.upsertedCount > 0,
      };
    }),
  );

  const inserted = results.filter((r) => r.inserted).length;
  const skipped = results.length - inserted;
  logger.info({ inserted, skipped, programs: results }, 'programs seeded');

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'seed failed');
  try {
    await disconnectDb();
  } catch {
    // noop
  }
  process.exit(1);
});
