import { z } from 'zod';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import { ApplicationDraft, User } from '../src/models/index.js';
import { copyPersonalDetailsFromDraft } from '../src/services/admissions/applicantConversionService.js';

// One-time backfill for Q-M10-followup-7. M10b added personal-detail
// fields on User (dateOfBirth / personalAddress / emergencyContact /
// parentGuardian) and the applicant→student conversion service copies
// them from ApplicationDraft step2/step3. But every student created BEFORE
// M10b shipped has those fields blank — even though their ApplicationDraft
// data is still on disk. This script copies the fields forward.
//
// Usage:
//   npm run backfill:personal-details -w api          # dry run, summary only
//   npm run backfill:personal-details -w api -- --apply  # actually save
//
// Idempotent: the underlying `copyPersonalDetailsFromDraft` only fills
// fields that are still null on the User, so running this twice does
// nothing the second time.

const BackfillEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
});

interface RowSummary {
  userId: string;
  userCode: string | null;
  userEmail: string;
  filled: string[];
  skipped: boolean;
}

async function main(): Promise<void> {
  const parsed = BackfillEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'backfill env invalid');
    process.exit(2);
  }
  const apply = process.argv.includes('--apply');
  logger.info({ apply }, apply ? 'backfill: APPLY mode (writes)' : 'backfill: DRY-RUN mode');

  await connectDb(parsed.data.MONGODB_URI);

  // Candidate students: anyone missing at least one of the four fields.
  const candidates = await User.find({
    role: 'student',
    deletedAt: null,
    $or: [
      { dateOfBirth: null },
      { personalAddress: null },
      { emergencyContact: null },
      { parentGuardian: null },
    ],
  }).select({
    _id: 1,
    code: 1,
    email: 1,
    name: 1,
    dateOfBirth: 1,
    personalAddress: 1,
    emergencyContact: 1,
    parentGuardian: 1,
  });

  logger.info({ candidateCount: candidates.length }, 'backfill candidates loaded');

  if (candidates.length === 0) {
    logger.info('Nothing to backfill — every student already has full personal details.');
    await disconnectDb();
    return;
  }

  const rows: RowSummary[] = [];
  let writeCount = 0;
  let skipCount = 0;

  for (const u of candidates) {
    const before = {
      dateOfBirth: u.dateOfBirth,
      personalAddress: u.personalAddress,
      emergencyContact: u.emergencyContact,
      parentGuardian: u.parentGuardian,
    };

    // Find the latest draft for this user. There should normally be exactly
    // one — but if the applicant had multiple applications (rare), pick the
    // most recently updated.
    const draft = await ApplicationDraft.findOne({ applicantUserId: u._id }).sort({
      lastModifiedAt: -1,
    });
    if (!draft) {
      rows.push({
        userId: String(u._id),
        userCode: u.code ?? null,
        userEmail: u.email,
        filled: [],
        skipped: true,
      });
      skipCount += 1;
    } else {
      const mutable = {
        name: u.name,
        dateOfBirth: u.dateOfBirth,
        personalAddress: u.personalAddress,
        emergencyContact: u.emergencyContact,
        parentGuardian: u.parentGuardian,
      };
      copyPersonalDetailsFromDraft(draft.data as Record<string, unknown>, mutable);

      const filled: string[] = [];
      if (before.dateOfBirth == null && mutable.dateOfBirth != null) filled.push('dateOfBirth');
      if (before.personalAddress == null && mutable.personalAddress != null) {
        filled.push('personalAddress');
      }
      if (before.emergencyContact == null && mutable.emergencyContact != null) {
        filled.push('emergencyContact');
      }
      if (before.parentGuardian == null && mutable.parentGuardian != null) {
        filled.push('parentGuardian');
      }

      rows.push({
        userId: String(u._id),
        userCode: u.code ?? null,
        userEmail: u.email,
        filled,
        skipped: filled.length === 0,
      });
      if (filled.length === 0) {
        skipCount += 1;
      } else if (apply) {
        u.dateOfBirth = mutable.dateOfBirth;
        // The User model uses Mixed for these structured fields, so direct
        // assignment is fine — mongoose tracks dirty paths.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u as any).personalAddress = mutable.personalAddress;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u as any).emergencyContact = mutable.emergencyContact;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u as any).parentGuardian = mutable.parentGuardian;
        await u.save();
        writeCount += 1;
      }
    }
  }

  // Compact summary table — pinos default JSON output is searchable by
  // userId / userCode so ops can audit a given conversion later.
  for (const r of rows) {
    logger.info(r, r.skipped ? 'backfill: skip' : 'backfill: filled');
  }
  logger.info(
    {
      candidates: candidates.length,
      apply,
      writes: writeCount,
      skipped: skipCount,
    },
    apply ? 'backfill complete' : 'backfill dry-run complete (re-run with --apply to write)',
  );

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'backfill failed');
  try {
    await disconnectDb();
  } catch {
    // noop
  }
  process.exit(1);
});
