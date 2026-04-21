import { z } from 'zod';
import type { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  ApiCostLedger,
  Batch,
  Course,
  Enrollment,
  FeeStructure,
  Holiday,
  NotificationPrefs,
  Program,
  Ticket,
  TimetableEntry,
  TimetableOverride,
  User,
  type HydratedUser,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';
import { generateForEnrollment } from '../src/services/invoiceGenerationService.js';
import { recordPayment } from '../src/services/paymentService.js';
import { utcDateForIstDay } from '../src/services/timetableTz.js';
import { nextTicketCode } from '../src/services/counterService.js';
import {
  issueForEnrollment,
  registerCertificateListener,
} from '../src/services/certificateService.js';
import { recordApiCost } from '../src/services/apiCostService.js';

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

async function seedFinanceStaff(): Promise<{ inserted: number; skipped: number }> {
  const email = 'finance-seed-1@luc.local';
  let user = await User.findOne({ email });
  if (user) return { inserted: 0, skipped: 1 };
  const passwordHash = await hashPassword('Finance#12345');
  user = await User.create({
    role: 'finance',
    code: null,
    name: 'Seed Finance One',
    email,
    phoneE164: '+911234567891',
    status: 'active',
    passwordHash,
    passwordUpdatedAt: new Date(),
    deptTag: 'finance',
  });
  return { inserted: 1, skipped: 0 };
}

async function seedFeeStructure(
  programSlug: string,
): Promise<{ inserted: number; skipped: number }> {
  const program = await Program.findOne({ slug: programSlug });
  if (!program) return { inserted: 0, skipped: 1 };
  const existing = await FeeStructure.findOne({
    programId: program._id,
    name: 'Aviation Diploma — 2026 default',
  });
  if (existing) return { inserted: 0, skipped: 1 };
  await FeeStructure.create({
    programId: program._id,
    name: 'Aviation Diploma — 2026 default',
    components: [
      {
        kind: 'registration',
        label: 'Registration Fee',
        amountPaise: 1_000_000,
        cadence: 'one_time',
        monthlyCount: null,
        dueRule: 'on_enrolment',
        weights: null,
      },
      {
        kind: 'tuition',
        label: 'Tuition Fee',
        amountPaise: 6_000_000,
        cadence: 'monthly_x',
        monthlyCount: 3,
        dueRule: 'on_enrolment',
        weights: null,
      },
      {
        kind: 'exam',
        label: 'Examination Fee',
        amountPaise: 400_000,
        cadence: 'one_time',
        monthlyCount: null,
        dueRule: 'month_before_end',
        weights: null,
      },
    ],
    paymentTerms:
      'Fees payable in INR. Installments due on the schedule shown on your Fees page. Late-payment notices start 14 days before the due date.',
  });
  return { inserted: 1, skipped: 0 };
}

async function seedStudentAndEnrolment(
  programSlug: string,
  batchName: string,
): Promise<{
  student: HydratedUser | null;
  enrolment: Awaited<ReturnType<typeof Enrollment.findOne>> | null;
  inserted: number;
  skipped: number;
}> {
  const program = await Program.findOne({ slug: programSlug });
  const batch = program
    ? await Batch.findOne({ programId: program._id, name: batchName })
    : null;
  const course = program
    ? await Course.findOne({ programId: program._id, slug: 'airport-ground-ops' })
    : null;
  if (!program || !batch || !course) {
    return { student: null, enrolment: null, inserted: 0, skipped: 0 };
  }

  const email = 'student-seed-1@luc.local';
  let student = await User.findOne({ email });
  let inserted = 0;
  let skipped = 0;
  if (!student) {
    const passwordHash = await hashPassword('Student#12345');
    student = await User.create({
      role: 'student',
      code: 'IL-2026-0001',
      name: 'Seed Student One',
      email,
      phoneE164: '+911234500001',
      status: 'active',
      passwordHash,
      passwordUpdatedAt: new Date(),
      programId: program._id,
      batchId: batch._id,
      enrolmentValidFrom: batch.startDate,
      enrolmentValidTo: batch.endDate,
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  let enrolment = await Enrollment.findOne({
    studentId: student._id,
    courseId: course._id,
    status: 'active',
  });
  if (!enrolment) {
    enrolment = await Enrollment.create({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
      validFrom: batch.startDate,
      validTo: batch.endDate,
      status: 'active',
      accessState: 'active',
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  return { student, enrolment, inserted, skipped };
}

async function seedSampleFees(
  student: HydratedUser,
  enrolmentId: Types.ObjectId,
  financeUserId: Types.ObjectId,
): Promise<{ inserted: number; skipped: number }> {
  const result = await generateForEnrollment(String(enrolmentId), {
    actorUserId: financeUserId,
  });
  return { inserted: result.createdCount, skipped: result.skippedCount };
}

async function seedSamplePayment(
  student: HydratedUser,
  financeUserId: Types.ObjectId,
): Promise<{ inserted: number; skipped: number }> {
  const { Payment } = await import('../src/models/index.js');
  const existing = await Payment.findOne({ studentId: student._id });
  if (existing) return { inserted: 0, skipped: 1 };
  await recordPayment(
    {
      studentId: String(student._id),
      amountPaise: 1_000_000,
      method: 'upi',
      reference: 'SEED-REG-FEE-001',
      receivedAt: new Date().toISOString(),
      notes: 'Seed: registration fee payment',
    },
    { actorUserId: financeUserId },
  );
  return { inserted: 1, skipped: 0 };
}

async function seedTickets(
  student: HydratedUser,
  faculty: HydratedUser,
): Promise<{ inserted: number; skipped: number }> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const DAY = 86_400_000;
  let inserted = 0;
  let skipped = 0;

  // 1. Academic ticket — currently in progress. Demonstrates the assignee +
  //    firstAckAt happy path. Natural key: subject + student.
  const academicSubject = 'Video playback stuck on mobile';
  const academicExists = await Ticket.findOne({
    studentId: student._id,
    subject: academicSubject,
  });
  if (!academicExists) {
    const code = await nextTicketCode('academic', year);
    await Ticket.create({
      code,
      category: 'academic',
      priority: 'medium',
      studentId: student._id,
      subject: academicSubject,
      description:
        'The airport ground-ops module 2 video buffers forever on my phone but plays fine on desktop.',
      state: 'in_progress',
      assigneeUserId: faculty._id,
      assignedAt: now,
      firstAckAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      slaAckDeadline: new Date(now.getTime() + 22 * 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() + 5 * DAY),
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  // 2. Academic ticket — closed two days ago so the reopen window (7d) is
  //    still open for a demo. Unlocks the complaint precondition (D-008).
  const closedSubject = 'Module 1 PDF missing page 12';
  const closedExists = await Ticket.findOne({
    studentId: student._id,
    subject: closedSubject,
  });
  if (!closedExists) {
    const code = await nextTicketCode('academic', year);
    const closedAt = new Date(now.getTime() - 2 * DAY);
    await Ticket.create({
      code,
      category: 'academic',
      priority: 'low',
      studentId: student._id,
      subject: closedSubject,
      description: 'Seeded as resolved+closed so demos can use the reopen flow.',
      state: 'closed',
      assigneeUserId: faculty._id,
      assignedAt: new Date(closedAt.getTime() - 3 * DAY),
      firstAckAt: new Date(closedAt.getTime() - 3 * DAY),
      resolvedAt: new Date(closedAt.getTime() - DAY),
      resolvedByUserId: faculty._id,
      resolutionNote: 'Replaced the PDF; verified with student.',
      closedAt,
      slaAckDeadline: new Date(closedAt.getTime() - 2 * DAY),
      slaResolveDeadline: new Date(closedAt.getTime() + 2 * DAY),
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  // 3. Finance ticket — proves the fees-suspension whitelist (D-052).
  const financeSubject = 'Installment receipt missing my name';
  const financeExists = await Ticket.findOne({
    studentId: student._id,
    subject: financeSubject,
  });
  if (!financeExists) {
    const code = await nextTicketCode('finance', year);
    const finance = await User.findOne({ email: 'finance-seed-1@luc.local' });
    await Ticket.create({
      code,
      category: 'finance',
      priority: 'medium',
      studentId: student._id,
      subject: financeSubject,
      description: 'Name mis-spelled on the registration receipt — please reissue.',
      state: finance ? 'assigned' : 'open',
      assigneeUserId: finance?._id ?? null,
      assignedAt: finance ? now : null,
      slaAckDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() + 5 * DAY),
    });
    inserted += 1;
  } else {
    skipped += 1;
  }

  return { inserted, skipped };
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

async function seedNotificationPrefs(): Promise<{ inserted: number; skipped: number }> {
  const users = await User.find({ deletedAt: null }).select('_id');
  let inserted = 0;
  let skipped = 0;
  for (const u of users) {
    const existing = await NotificationPrefs.findOne({ userId: u._id });
    if (existing) {
      skipped += 1;
      continue;
    }
    await NotificationPrefs.create({
      userId: u._id,
      emailByType: {},
      whatsappByType: {},
    });
    inserted += 1;
  }
  return { inserted, skipped };
}

async function seedCertificateForStudent(
  enrolmentId: Types.ObjectId,
): Promise<{ issued: boolean; skipped: boolean; certificateUrl: string | null }> {
  const enrolment = await Enrollment.findById(enrolmentId);
  if (!enrolment) return { issued: false, skipped: true, certificateUrl: null };
  if (enrolment.certificateUrl) {
    return { issued: false, skipped: true, certificateUrl: enrolment.certificateUrl };
  }
  if (!enrolment.completed) {
    enrolment.completed = true;
    enrolment.completedAt = new Date();
    await enrolment.save();
  }
  // Listener wiring is normally done in api/src/index.ts at app boot; the
  // seed script runs standalone, so we wire + invoke directly.
  registerCertificateListener();
  const result = await issueForEnrollment({
    enrollmentId: enrolment._id,
    actor: 'listener',
  });
  return {
    issued: !result.reissued,
    skipped: false,
    certificateUrl: result.certificate.certificateUrl,
  };
}

async function seedApiCostLedgerDemo(): Promise<{ inserted: number; skipped: boolean }> {
  const existing = await ApiCostLedger.countDocuments({});
  if (existing > 0) return { inserted: 0, skipped: true };
  // Spread a handful of events across the last 7 days so the 14-day sparkline
  // has non-zero values.
  const samples = [
    { provider: 'email' as const, operation: 'email.send.primary', units: 1, daysAgo: 0 },
    { provider: 'email' as const, operation: 'email.send.primary', units: 1, daysAgo: 1 },
    { provider: 'email' as const, operation: 'email.send.primary', units: 1, daysAgo: 2 },
    { provider: 'whatsapp' as const, operation: 'whatsapp.template.il_fee_due', units: 1, daysAgo: 1 },
    { provider: 'whatsapp' as const, operation: 'whatsapp.template.il_payment_received', units: 1, daysAgo: 3 },
    { provider: 'storage' as const, operation: 'storage.upload.receipts', units: 1, daysAgo: 2 },
    { provider: 'certifier' as const, operation: 'certifier.issue', units: 1, daysAgo: 0 },
  ];
  for (const s of samples) {
    await recordApiCost({
      provider: s.provider,
      operation: s.operation,
      units: s.units,
    });
  }
  return { inserted: samples.length, skipped: false };
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

  const financeRes = await seedFinanceStaff();
  logger.info(financeRes, 'finance user seeded');

  const feeStructureRes = await seedFeeStructure('aviation-diploma');
  logger.info(feeStructureRes, 'fee structure seeded');

  const { student, enrolment, inserted: sInserted, skipped: sSkipped } =
    await seedStudentAndEnrolment(
      'aviation-diploma',
      'Aviation Batch 1 — July 2026',
    );
  logger.info({ inserted: sInserted, skipped: sSkipped }, 'student + enrolment seeded');

  const finance = await User.findOne({ email: 'finance-seed-1@luc.local' });
  if (student && enrolment && finance) {
    const feesRes = await seedSampleFees(student, enrolment._id, finance._id);
    logger.info(feesRes, 'invoices + installments seeded');

    const payRes = await seedSamplePayment(student, finance._id);
    logger.info(payRes, 'sample payment seeded');
  }

  if (student && faculty) {
    const ticketsRes = await seedTickets(student, faculty);
    logger.info(ticketsRes, 'tickets seeded');
  }

  // M8 — ensure every seeded user has a NotificationPrefs row so first-login
  // UX doesn't lazily insert. Idempotent (model has unique index on userId).
  const prefsRes = await seedNotificationPrefs();
  logger.info(prefsRes, 'notification prefs seeded');

  // M8 — seed a completed enrolment + trigger certificate issue so the demo
  // student has a visible certificate. Safe to re-run: issueForEnrollment is
  // idempotent (returns existing URL if already issued).
  if (student && enrolment) {
    const certRes = await seedCertificateForStudent(enrolment._id);
    logger.info(certRes, 'certificate seeded');
  }

  // M8 — backfill a few ApiCostLedger rows so analytics summary has non-zero
  // api-cost data in dev.
  const costRes = await seedApiCostLedgerDemo();
  logger.info(costRes, 'api cost ledger seeded');

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
