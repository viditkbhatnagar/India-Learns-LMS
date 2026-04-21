import { z } from 'zod';
import type { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  Batch,
  Course,
  Holiday,
  Program,
  TimetableEntry,
  TimetableOverride,
  User,
  type HydratedUser,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';
import { utcDateForIstDay } from '../src/services/timetableTz.js';

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

async function seedPrograms(): Promise<{ inserted: number; skipped: number }> {
  const results = await Promise.all(
    PROGRAMS.map(async (p) => {
      const res = await Program.updateOne(
        { slug: p.slug },
        { $setOnInsert: p },
        { upsert: true },
      );
      return { slug: p.slug, inserted: res.upsertedCount > 0 };
    }),
  );
  const inserted = results.filter((r) => r.inserted).length;
  return { inserted, skipped: results.length - inserted };
}

async function seedFacultyAndCourse(): Promise<{
  course: Awaited<ReturnType<typeof Course.findOne>>;
  faculty: HydratedUser;
  inserted: number;
  skipped: number;
}> {
  const program = await Program.findOne({ slug: 'aviation-diploma' });
  if (!program) throw new Error('seed: Aviation program missing.');

  let inserted = 0;
  let skipped = 0;

  const facultyEmail = 'faculty-seed-1@luc.local';
  let faculty = await User.findOne({ email: facultyEmail });
  if (!faculty) {
    const passwordHash = await hashPassword('Faculty#12345');
    faculty = await User.create({
      role: 'faculty',
      code: null,
      name: 'Seed Faculty One',
      email: facultyEmail,
      phoneE164: '+911234567890',
      status: 'active',
      passwordHash,
      passwordUpdatedAt: new Date(),
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  let course = await Course.findOne({
    programId: program._id,
    slug: 'airport-ground-ops',
  });
  if (!course) {
    course = await Course.create({
      programId: program._id,
      slug: 'airport-ground-ops',
      name: 'Airport Ground Ops',
      summary: 'Seeded M4 sample course for timetable demos.',
      state: 'published',
      publishedAt: new Date(),
      publishedVersion: 1,
      sequential: false,
      facultyIds: [faculty._id],
    });
    inserted += 1;
  } else {
    let dirty = false;
    if (!course.facultyIds.some((id) => id.equals(faculty!._id))) {
      course.facultyIds.push(faculty._id);
      dirty = true;
    }
    if (course.state !== 'published') {
      course.state = 'published';
      course.publishedAt = course.publishedAt ?? new Date();
      course.publishedVersion = course.publishedVersion || 1;
      dirty = true;
    }
    if (dirty) await course.save();
    skipped += 1;
  }

  return { course, faculty, inserted, skipped };
}

async function seedBatch(programSlug: string, name: string): Promise<{
  batch: Awaited<ReturnType<typeof Batch.findOne>>;
  inserted: number;
  skipped: number;
}> {
  const program = await Program.findOne({ slug: programSlug });
  if (!program) throw new Error(`seed: program missing: ${programSlug}`);
  let batch = await Batch.findOne({ programId: program._id, name });
  if (!batch) {
    batch = await Batch.create({
      programId: program._id,
      name,
      startDate: utcDateForIstDay('2026-07-06'), // Monday 6 Jul 2026 IST
      endDate: utcDateForIstDay('2026-12-28'),
      capacity: 30,
      status: 'active',
      coordinators: [],
    });
    return { batch, inserted: 1, skipped: 0 };
  }
  return { batch, inserted: 0, skipped: 1 };
}

async function seedTimetableEntries(
  batchId: Types.ObjectId,
  courseId: Types.ObjectId,
  facultyId: Types.ObjectId,
): Promise<{ inserted: number; skipped: number }> {
  // Mon 18:00–20:00 IST, Wed 18:00–20:00 IST.
  const slots = [
    { dayOfWeek: 1, start: 1080, end: 1200, room: 'Room 1' },
    { dayOfWeek: 3, start: 1080, end: 1200, room: 'Room 1' },
  ];
  const outcomes = await Promise.all(
    slots.map(async (s) => {
      const existing = await TimetableEntry.findOne({
        batchId,
        dayOfWeek: s.dayOfWeek,
        startTimeMinutes: s.start,
        deletedAt: null,
      });
      if (existing) return 'skipped' as const;
      await TimetableEntry.create({
        batchId,
        courseId,
        facultyId,
        dayOfWeek: s.dayOfWeek,
        startTimeMinutes: s.start,
        endTimeMinutes: s.end,
        room: s.room,
        notes: 'Seeded M4 sample session.',
      });
      return 'inserted' as const;
    }),
  );
  const inserted = outcomes.filter((o) => o === 'inserted').length;
  return { inserted, skipped: outcomes.length - inserted };
}

async function seedOverride(
  batchId: Types.ObjectId,
): Promise<{ inserted: number; skipped: number }> {
  // Reschedule the Wednesday 8 Jul 2026 session to 19:00–21:00.
  const wed = await TimetableEntry.findOne({
    batchId,
    dayOfWeek: 3,
    deletedAt: null,
  });
  if (!wed) return { inserted: 0, skipped: 0 };
  const date = utcDateForIstDay('2026-07-08');
  const existing = await TimetableOverride.findOne({
    batchId,
    entryId: wed._id,
    date,
  });
  if (existing) return { inserted: 0, skipped: 1 };
  await TimetableOverride.create({
    batchId,
    entryId: wed._id,
    date,
    action: 'reschedule',
    newStartMinutes: 1140,
    newEndMinutes: 1260,
    reason: 'Seeded M4 sample reschedule.',
  });
  return { inserted: 1, skipped: 0 };
}

async function seedHoliday(): Promise<{ inserted: number; skipped: number }> {
  // 15 Aug — Independence Day (IST).
  const date = utcDateForIstDay('2026-08-15');
  const existing = await Holiday.findOne({ date });
  if (existing) return { inserted: 0, skipped: 1 };
  await Holiday.create({
    date,
    name: 'Independence Day',
    kind: 'public',
  });
  return { inserted: 1, skipped: 0 };
}

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'seed env invalid');
    process.exit(2);
  }

  await connectDb(parsed.data.MONGODB_URI);

  const programsRes = await seedPrograms();
  logger.info(programsRes, 'programs seeded');

  const { course, faculty, inserted: cInserted, skipped: cSkipped } =
    await seedFacultyAndCourse();
  logger.info({ inserted: cInserted, skipped: cSkipped }, 'faculty + course seeded');

  const { batch, inserted: bInserted, skipped: bSkipped } =
    await seedBatch('aviation-diploma', 'Aviation Batch 1 — July 2026');
  logger.info({ inserted: bInserted, skipped: bSkipped }, 'batch seeded');

  if (course && batch) {
    const entriesRes = await seedTimetableEntries(
      batch._id,
      course._id,
      faculty._id,
    );
    logger.info(entriesRes, 'timetable entries seeded');

    const overrideRes = await seedOverride(batch._id);
    logger.info(overrideRes, 'timetable override seeded');
  }

  const holidayRes = await seedHoliday();
  logger.info(holidayRes, 'holiday seeded');

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
