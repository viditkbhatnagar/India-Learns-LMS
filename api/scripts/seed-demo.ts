import { z } from 'zod';
import type { Types } from 'mongoose';
import { addDays } from 'date-fns';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  Batch,
  Course,
  Enrollment,
  FeeInstallment,
  FeeStructure,
  Holiday,
  NotificationPrefs,
  Program,
  User,
  type HydratedUser,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';
import { generateForEnrollment } from '../src/services/invoiceGenerationService.js';
import { utcDateForIstDay } from '../src/services/timetableTz.js';

const SeedEnv = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
});

// Today anchor. Kept as a constant so log output is reproducible even if the
// script is re-run close to IST midnight.
const NOW = new Date();

function nextMondayIstIsoDate(from: Date): string {
  // 0 = Sun, 1 = Mon ... using UTC getDay is fine since IST ≈ UTC+5:30 and
  // we just need the calendar-day-of-week bucket.
  const d = new Date(from.getTime());
  const day = d.getUTCDay();
  const delta = day === 1 ? 7 : (8 - day) % 7; // always strictly future Monday
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const NEXT_MONDAY_ISO = nextMondayIstIsoDate(NOW);
const BATCH_START = utcDateForIstDay(NEXT_MONDAY_ISO);
const BATCH_END = addDays(BATCH_START, 182); // ~6 months

const PROGRAMS = [
  {
    slug: 'aviation-diploma',
    name: 'Aviation Diploma',
    description: 'India Learns 300-hour in-person Aviation Diploma.',
    totalHours: 300,
    isActive: true,
  },
  {
    slug: 'retail-fashion-diploma',
    name: 'Retail & Fashion Diploma',
    description: 'India Learns 300-hour in-person Retail & Fashion Diploma.',
    totalHours: 300,
    isActive: true,
  },
] as const;

// Demo student codes live in the 0101+ range so seed-demo.ts and the broader
// seed.ts (which claims IL-2026-0001) can coexist in the same cluster without
// colliding on the User.code unique partial index.
const DEMO_STUDENTS = [
  { code: 'IL-2026-0101', name: 'Demo Student One', email: 'student-demo-1@luc.local', phone: '+911234500011' },
  { code: 'IL-2026-0102', name: 'Demo Student Two', email: 'student-demo-2@luc.local', phone: '+911234500012' },
  { code: 'IL-2026-0103', name: 'Demo Student Three', email: 'student-demo-3@luc.local', phone: '+911234500013' },
] as const;

async function upsertPrograms(): Promise<void> {
  for (const p of PROGRAMS) {
    await Program.updateOne({ slug: p.slug }, { $setOnInsert: p }, { upsert: true });
  }
}

async function ensureFaculty(): Promise<HydratedUser> {
  const email = 'faculty-demo-1@luc.local';
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    role: 'faculty',
    code: null,
    name: 'Demo Faculty One',
    email,
    phoneE164: '+911234500090',
    status: 'active',
    passwordHash: await hashPassword('Faculty#12345'),
    passwordUpdatedAt: NOW,
  });
}

/**
 * M10r — `finance` role removed; admin handles every finance action. We keep
 * this helper as a thin wrapper that returns the first admin user so existing
 * callers (which pass the returned id as `actorUserId`) keep working without
 * touching every call site.
 */
async function ensureFinance(): Promise<HydratedUser> {
  const admin = await User.findOne({ role: 'admin', deletedAt: null });
  if (admin) return admin;
  // Defensive fallback: if no admin exists yet, create a demo one so the rest
  // of the seed-demo script can attribute payments.
  return User.create({
    role: 'admin',
    code: null,
    name: 'Demo Admin (finance fallback)',
    email: 'admin-demo-1@luc.local',
    phoneE164: '+911234500091',
    status: 'active',
    passwordHash: await hashPassword('Admin#12345'),
    passwordUpdatedAt: NOW,
    deptTag: 'finance',
  });
}

async function ensureBatch(programSlug: string, name: string): Promise<NonNullable<Awaited<ReturnType<typeof Batch.findOne>>>> {
  const program = await Program.findOne({ slug: programSlug });
  if (!program) throw new Error(`demo-seed: program missing: ${programSlug}`);
  const existing = await Batch.findOne({ programId: program._id, name });
  if (existing) return existing;
  return Batch.create({
    programId: program._id,
    name,
    startDate: BATCH_START,
    endDate: BATCH_END,
    capacity: 30,
    status: 'planned',
    coordinators: [],
  });
}

async function ensureCourse(programSlug: string, slug: string, displayName: string, facultyId: Types.ObjectId): Promise<NonNullable<Awaited<ReturnType<typeof Course.findOne>>>> {
  const program = await Program.findOne({ slug: programSlug });
  if (!program) throw new Error(`demo-seed: program missing: ${programSlug}`);
  const existing = await Course.findOne({ programId: program._id, slug });
  if (existing) {
    if (!existing.facultyIds.some((id) => id.equals(facultyId))) {
      existing.facultyIds.push(facultyId);
      await existing.save();
    }
    return existing;
  }
  return Course.create({
    programId: program._id,
    slug,
    name: displayName,
    summary: 'Demo seed course for pre-launch verification.',
    state: 'published',
    publishedAt: NOW,
    publishedVersion: 1,
    sequential: false,
    facultyIds: [facultyId],
  });
}

async function ensureFeeStructure(programSlug: string): Promise<void> {
  const program = await Program.findOne({ slug: programSlug });
  if (!program) throw new Error(`demo-seed: program missing: ${programSlug}`);
  const name = 'Aviation Diploma — 40/30/30 demo';
  const existing = await FeeStructure.findOne({ programId: program._id, name });
  if (existing) return;
  await FeeStructure.create({
    programId: program._id,
    name,
    // Single 3-installment tuition component with weights [40, 30, 30]. The
    // dueRule enum lacks a 60-day cadence (Q-M5-01), so we use on_enrolment
    // (30-day gaps) at structure time and then shift the *first* installment
    // to today+7 in the caller below — this is what the pre-launch
    // verification cron window needs.
    components: [
      {
        kind: 'tuition',
        label: 'Tuition Fee (40/30/30)',
        amountPaise: 7_500_000, // ₹75,000 total
        cadence: 'monthly_x',
        monthlyCount: 3,
        dueRule: 'on_enrolment',
        weights: [40, 30, 30],
      },
    ],
    paymentTerms:
      'Pre-launch demo: 40/30/30 tuition split. First installment due 7 days from seed run so fee reminder cron has something to fire on.',
  });
}

interface StudentSpec {
  code: string;
  name: string;
  email: string;
  phone: string;
}

async function ensureStudent(spec: StudentSpec, programId: Types.ObjectId, batchId: Types.ObjectId, validFrom: Date, validTo: Date): Promise<HydratedUser> {
  const existing = await User.findOne({ email: spec.email });
  if (existing) return existing;

  // Sanity check: make sure the code isn't held by a different user (e.g.
  // after running seed.ts before seed-demo.ts). If so, surface a clear error
  // rather than letting the unique index blow up inside Mongoose.
  const codeHolder = await User.findOne({ code: spec.code });
  if (codeHolder && codeHolder.email !== spec.email) {
    throw new Error(
      `demo-seed: code ${spec.code} already belongs to ${codeHolder.email} — run seed.ts or seed-demo.ts, not both, or drop india_learns.users first.`,
    );
  }

  return User.create({
    role: 'student',
    code: spec.code,
    name: spec.name,
    email: spec.email,
    phoneE164: spec.phone,
    status: 'active',
    passwordHash: await hashPassword('Student#12345'),
    passwordUpdatedAt: NOW,
    programId,
    batchId,
    enrolmentValidFrom: validFrom,
    enrolmentValidTo: validTo,
  });
}

async function ensureEnrolment(studentId: Types.ObjectId, batchId: Types.ObjectId, courseId: Types.ObjectId, programId: Types.ObjectId, validFrom: Date, validTo: Date): Promise<NonNullable<Awaited<ReturnType<typeof Enrollment.findOne>>>> {
  const existing = await Enrollment.findOne({ studentId, courseId, status: 'active' });
  if (existing) return existing;
  return Enrollment.create({
    studentId,
    batchId,
    courseId,
    programId,
    validFrom,
    validTo,
    status: 'active',
    accessState: 'active',
  });
}

async function ensureHoliday(isoDate: string, name: string): Promise<'inserted' | 'skipped'> {
  const date = utcDateForIstDay(isoDate);
  const existing = await Holiday.findOne({ date });
  if (existing) return 'skipped';
  await Holiday.create({ date, name, kind: 'public' });
  return 'inserted';
}

async function ensureNotificationPrefs(userId: Types.ObjectId): Promise<void> {
  const existing = await NotificationPrefs.findOne({ userId });
  if (existing) return;
  await NotificationPrefs.create({
    userId,
    emailByType: {},
    whatsappByType: {},
  });
}

async function shiftFirstInstallmentToT7(studentId: Types.ObjectId): Promise<number> {
  // The reminder cron fires relative to FeeInstallment.dueDate. For
  // pre-launch verification we want the first installment due exactly 7 days
  // from now so T-7 lands today. Idempotent: only adjust when current
  // dueDate is in the future (hasn't been overridden manually).
  const target = addDays(NOW, 7);
  const first = await FeeInstallment.findOne({ studentId }).sort({ dueDate: 1 });
  if (!first) return 0;
  if (Math.abs(first.dueDate.getTime() - target.getTime()) < 60_000) return 0;
  first.dueDate = target;
  await first.save();
  return 1;
}

async function main(): Promise<void> {
  const parsed = SeedEnv.safeParse(process.env);
  if (!parsed.success) {
    logger.fatal({ issues: parsed.error.flatten().fieldErrors }, 'demo-seed env invalid');
    process.exit(2);
  }

  await connectDb(parsed.data.MONGODB_URI);

  logger.info({ nextMonday: NEXT_MONDAY_ISO, firstInstallmentInDays: 7 }, 'demo-seed starting');

  await upsertPrograms();
  const faculty = await ensureFaculty();
  const finance = await ensureFinance();

  const aviation = await Program.findOne({ slug: 'aviation-diploma' });
  const retail = await Program.findOne({ slug: 'retail-fashion-diploma' });
  if (!aviation || !retail) throw new Error('demo-seed: programs missing after upsert.');

  const aviationBatch = await ensureBatch('aviation-diploma', 'Aviation Batch — Demo');
  const retailBatch = await ensureBatch('retail-fashion-diploma', 'Retail & Fashion Batch — Demo');

  const aviationCourse = await ensureCourse(
    'aviation-diploma',
    'airport-ground-ops',
    'Airport Ground Ops',
    faculty._id,
  );
  await ensureCourse('retail-fashion-diploma', 'retail-merchandising-101', 'Retail Merchandising 101', faculty._id);

  await ensureFeeStructure('aviation-diploma');

  // All 3 demo students enrol into the Aviation batch + Airport Ground Ops
  // course so invoice generation has a real program + course target. Retail
  // batch is left empty per the prompt.
  const students: HydratedUser[] = [];
  for (const spec of DEMO_STUDENTS) {
    const s = await ensureStudent(spec, aviation._id, aviationBatch._id, aviationBatch.startDate, aviationBatch.endDate);
    students.push(s);
    await ensureEnrolment(s._id, aviationBatch._id, aviationCourse._id, aviation._id, aviationBatch.startDate, aviationBatch.endDate);
    await ensureNotificationPrefs(s._id);
  }
  await ensureNotificationPrefs(faculty._id);
  await ensureNotificationPrefs(finance._id);

  // Generate fees for each student (idempotent per enrolment) then shift the
  // first installment's dueDate to T+7 so cron T-7 fires today.
  let invoicesCreated = 0;
  let installmentsShifted = 0;
  for (const s of students) {
    const enr = await Enrollment.findOne({ studentId: s._id, status: 'active' });
    if (enr) {
      const res = await generateForEnrollment(String(enr._id), { actorUserId: finance._id });
      invoicesCreated += res.createdCount;
      installmentsShifted += await shiftFirstInstallmentToT7(s._id);
    }
  }

  const holidayResults = [
    await ensureHoliday('2026-05-01', 'Labour Day'),
    await ensureHoliday('2026-05-13', 'Buddha Purnima (observed)'),
  ];

  logger.info(
    {
      students: students.length,
      aviationBatch: aviationBatch.name,
      retailBatch: retailBatch.name,
      courseAviation: aviationCourse.slug,
      invoicesCreated,
      installmentsShiftedToT7: installmentsShifted,
      holidays: holidayResults,
    },
    'demo-seed complete',
  );

  await disconnectDb();
}

main().catch(async (err) => {
  logger.fatal({ err }, 'demo-seed failed');
  try {
    await disconnectDb();
  } catch {
    // noop
  }
  process.exit(1);
});
