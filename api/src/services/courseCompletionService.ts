import { Types } from 'mongoose';
import {
  Enrollment,
  Exam,
  ExamAttempt,
  ModuleModel,
  Quiz,
  QuizAttempt,
} from '../models/index.js';
import { nowUtc } from './clockService.js';
import { recordAudit } from './auditService.js';
import { publishDomainEvent } from './domainEventService.js';

// Q-M7-01 decision: completion = every Quiz in every Module of the course has
// at least one passing QuizAttempt, AND at least one passing final-exam
// ExamAttempt exists. The PRD §13.1 "all modules' content opened" predicate
// was dropped — there is no content-access telemetry per Logan's Q3 ruling.
//
// Idempotent: if the enrolment is already completed we publish no new event.

export interface CompletionCheckResult {
  enrolmentId: string;
  completed: boolean;
  alreadyCompleted: boolean;
}

export async function checkAndMaybePublish(
  enrolmentId: Types.ObjectId | string,
  actorUserId: Types.ObjectId | null = null,
): Promise<CompletionCheckResult> {
  if (!Types.ObjectId.isValid(enrolmentId)) {
    return {
      enrolmentId: String(enrolmentId),
      completed: false,
      alreadyCompleted: false,
    };
  }
  const enrolment = await Enrollment.findById(enrolmentId);
  if (!enrolment) {
    return {
      enrolmentId: String(enrolmentId),
      completed: false,
      alreadyCompleted: false,
    };
  }
  if (enrolment.completed) {
    return {
      enrolmentId: enrolment._id.toString(),
      completed: true,
      alreadyCompleted: true,
    };
  }
  if (enrolment.status !== 'active') {
    return {
      enrolmentId: enrolment._id.toString(),
      completed: false,
      alreadyCompleted: false,
    };
  }

  const modules = await ModuleModel.find({
    courseId: enrolment.courseId,
    deletedAt: null,
  }).select('_id');
  const moduleIds = modules.map((m) => m._id);

  const quizzes = moduleIds.length > 0
    ? await Quiz.find({ moduleId: { $in: moduleIds } }).select('_id')
    : [];

  // Every quiz needs a passing attempt by this student.
  for (const quiz of quizzes) {
    const passed = await QuizAttempt.findOne({
      quizId: quiz._id,
      studentId: enrolment.studentId,
      passed: true,
    }).select('_id');
    if (!passed) {
      return {
        enrolmentId: enrolment._id.toString(),
        completed: false,
        alreadyCompleted: false,
      };
    }
  }

  // At least one final exam for the course must have a passing attempt.
  const exams = await Exam.find({ courseId: enrolment.courseId }).select('_id');
  if (exams.length === 0) {
    return {
      enrolmentId: enrolment._id.toString(),
      completed: false,
      alreadyCompleted: false,
    };
  }
  const examIds = exams.map((e) => e._id);
  const passedExam = await ExamAttempt.findOne({
    examId: { $in: examIds },
    studentId: enrolment.studentId,
    passed: true,
  }).select('_id');
  if (!passedExam) {
    return {
      enrolmentId: enrolment._id.toString(),
      completed: false,
      alreadyCompleted: false,
    };
  }

  const now = nowUtc();
  const before = enrolment.toJSON();
  enrolment.completed = true;
  enrolment.completedAt = now;
  await enrolment.save();

  await recordAudit({
    actorUserId,
    action: 'enrollment.completed',
    targetType: 'Enrollment',
    targetId: enrolment._id,
    before,
    after: enrolment.toJSON(),
    details: {
      courseId: enrolment.courseId.toString(),
      studentId: enrolment.studentId.toString(),
    },
  });

  await publishDomainEvent('course.completed', {
    enrolmentId: enrolment._id.toString(),
    studentId: enrolment.studentId.toString(),
    courseId: enrolment.courseId.toString(),
    programId: enrolment.programId.toString(),
    completedAt: now.toISOString(),
  });

  return {
    enrolmentId: enrolment._id.toString(),
    completed: true,
    alreadyCompleted: false,
  };
}

export async function checkAllActiveEnrolmentsForStudentCourse(
  studentId: Types.ObjectId,
  courseId: Types.ObjectId,
  actorUserId: Types.ObjectId | null = null,
): Promise<CompletionCheckResult[]> {
  const enrolments = await Enrollment.find({
    studentId,
    courseId,
    status: 'active',
    completed: false,
  }).select('_id');
  const results: CompletionCheckResult[] = [];
  for (const e of enrolments) {
    results.push(await checkAndMaybePublish(e._id, actorUserId));
  }
  return results;
}
