// Seed 3 UAT students directly into the imported "Maths Certification"
// course's program. Bypasses the magic-link invite flow so the students
// have known credentials we can hand to a real faculty member for UAT.
//
// Idempotent — safe to re-run:
//   - Users matching the email are kept; password is re-set.
//   - Enrolments are skipped if the student already has an active
//     enrolment in the program (the duplicate-program rule).
//
// Run:
//   tsx api/scripts/seed-uat-students.ts
//
// To target staging on the dev cluster, override MONGODB_URI:
//   MONGODB_URI="...india_learns_staging..." tsx scripts/seed-uat-students.ts
//
// Designed to point at staging via the same MONGODB_URI as the rest of
// the api workspace. Audit-logs every write so the operator has a
// record. Looking for the imported workflow course by sourceWorkflowId
// — uses the Maths Certification fixture from Phase A
// (69bbf3cd5c4093e441e75eba).

import { z } from 'zod';
import type { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';
import {
  Batch,
  Course,
  Enrollment,
  User,
} from '../src/models/index.js';
import { hashPassword } from '../src/services/passwordService.js';
import { recordAudit } from '../src/services/auditService.js';

const SOURCE_WORKFLOW_ID = '69bbf3cd5c4093e441e75eba'; // Maths Certification

const UAT_STUDENTS = [
  {
    email: 'uat-student-1@luc.local',
    name: 'UAT Student One',
    phoneE164: '+919900000201',
    code: 'UAT-001',
  },
  {
    email: 'uat-student-2@luc.local',
    name: 'UAT Student Two',
    phoneE164: '+919900000202',
    code: 'UAT-002',
  },
  {
    email: 'uat-student-3@luc.local',
    name: 'UAT Student Three',
    phoneE164: '+919900000203',
    code: 'UAT-003',
  },
];

const PASSWORD = 'Uat#student-2026';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const Env = z.object({ MONGODB_URI: z.string().min(1) });

async function enrolIntoAllProgramCourses(
  studentId: Types.ObjectId,
  batchId: Types.ObjectId,
  programId: Types.ObjectId,
  studentEmail: string,
): Promise<void> {
  // enrolStudent (in src/services/enrollmentService.ts) creates one row
  // per course in the program. We mimic that here directly so the script
  // doesn't need an HTTP server running. Audit-log each create.
  const courses = await Course.find({ programId, deletedAt: null });
  const validFrom = new Date();
  const validTo = new Date(Date.now() + ONE_YEAR_MS);
  for (const course of courses) {
    const enr = await Enrollment.create({
      studentId,
      batchId,
      courseId: course._id,
      programId: course.programId,
      validFrom,
      validTo,
      status: 'active',
      accessState: 'active',
    });
    await recordAudit({
      actorUserId: null, // operator-run script
      action: 'enrollment.created',
      targetType: 'Enrollment',
      targetId: enr._id,
      details: {
        source: 'seed-uat-students',
        studentEmail,
        courseId: String(course._id),
        courseName: course.name,
      },
    });
    logger.info(
      { email: studentEmail, courseId: String(course._id), courseName: course.name },
      'enrolled',
    );
  }
}

async function main(): Promise<void> {
  Env.parse(process.env);
  await connectDb();

  // Find the imported Maths course by sourceWorkflowId.
  const mathsCourse = await Course.findOne({
    sourceWorkflowId: SOURCE_WORKFLOW_ID,
    deletedAt: null,
  });
  if (!mathsCourse) {
    logger.fatal(
      { sourceWorkflowId: SOURCE_WORKFLOW_ID },
      'no imported course found — run curriculum-import first',
    );
    await disconnectDb();
    process.exit(3);
  }
  logger.info(
    { courseId: String(mathsCourse._id), name: mathsCourse.name, programId: String(mathsCourse.programId) },
    'target course resolved',
  );

  // Pick any active batch in the same program; create one if none exists.
  let batch = await Batch.findOne({
    programId: mathsCourse.programId,
    status: 'active',
  });
  if (!batch) {
    batch = await Batch.create({
      programId: mathsCourse.programId,
      name: 'UAT Batch — Maths Certification',
      startDate: new Date(),
      endDate: new Date(Date.now() + ONE_YEAR_MS),
      capacity: 30,
      status: 'active',
    });
    logger.info({ batchId: String(batch._id) }, 'created active batch for UAT');
  }
  logger.info({ batchId: String(batch._id), name: batch.name }, 'target batch resolved');

  const passwordHash = await hashPassword(PASSWORD);

  for (const stu of UAT_STUDENTS) {
    // Upsert the user. Status active so they can sign in immediately.
    const existing = await User.findOne({ email: stu.email });
    let userDoc;
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.status = 'active';
      existing.suspensionKind = null;
      existing.suspensionReason = null;
      await existing.save();
      userDoc = existing;
      logger.info({ email: stu.email, id: String(existing._id) }, 'user updated');
    } else {
      userDoc = await User.create({
        email: stu.email,
        name: stu.name,
        phoneE164: stu.phoneE164,
        role: 'student',
        status: 'active',
        passwordHash,
        passwordSetAt: new Date(),
        code: stu.code,
        programId: mathsCourse.programId,
        batchId: batch._id,
        enrolmentValidFrom: new Date(),
        enrolmentValidTo: new Date(Date.now() + ONE_YEAR_MS),
      });
      logger.info({ email: stu.email, id: String(userDoc._id) }, 'user created');
    }

    // Skip enrolment if the student already has an active one in this
    // program (the duplicate-program rule).
    const dupe = await Enrollment.findOne({
      studentId: userDoc._id,
      programId: mathsCourse.programId,
      status: 'active',
    });
    if (dupe) {
      logger.info(
        { email: stu.email, courseId: String(dupe.courseId) },
        'enrolment exists; skipping',
      );
    } else {
      await enrolIntoAllProgramCourses(userDoc._id, batch._id, mathsCourse.programId, stu.email);
    }
  }

  await disconnectDb();
  logger.info(
    {
      students: UAT_STUDENTS.map((s) => ({ email: s.email, password: PASSWORD })),
      course: { id: String(mathsCourse._id), name: mathsCourse.name },
    },
    'seed-uat-students done',
  );
}

main().catch(async (err) => {
  logger.fatal({ err: err.message ?? err }, 'seed-uat-students failed');
  try { await disconnectDb(); } catch { /* ignore */ }
  process.exit(1);
});
