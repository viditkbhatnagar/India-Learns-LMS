import { z } from 'zod';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { User } from '../src/models/index.js';
import { hashPassword, validatePolicy } from '../src/services/passwordService.js';

const SeedEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required for seeding.'),
  SUPERADMIN_EMAIL: z.string().email(),
  SUPERADMIN_PASSWORD: z.string().min(10),
  SUPERADMIN_NAME: z.string().min(1),
  SUPERADMIN_PHONE: z.string().regex(/^\+\d{6,15}$/),
});

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'seed env invalid');
    process.exit(2);
  }
  validatePolicy(parsed.data.SUPERADMIN_PASSWORD);

  await connectDb(parsed.data.MONGODB_URI);

  const email = parsed.data.SUPERADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    logger.info({ id: String(existing._id), role: existing.role }, 'super-admin already exists — no-op');
    await disconnectDb();
    return;
  }

  const hashed = await hashPassword(parsed.data.SUPERADMIN_PASSWORD);
  const doc = await User.create({
    role: 'superadmin',
    name: parsed.data.SUPERADMIN_NAME.trim(),
    email,
    phoneE164: parsed.data.SUPERADMIN_PHONE.trim(),
    passwordHash: hashed,
    passwordUpdatedAt: new Date(),
    passwordHistoryHashes: [],
    status: 'active',
  });
  logger.info({ id: String(doc._id), email: doc.email }, 'super-admin seeded');
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
