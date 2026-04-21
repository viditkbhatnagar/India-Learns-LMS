import { Types } from 'mongoose';
import type {
  CreateExamInput,
  ExamAttemptDto,
  ExamDto,
  ExamQuestionDto,
  QuizState,
  StudentExamDto,
  SubmitExamAttemptInput,
  UpdateExamInput,
} from 'india-learns-shared-types';
import type { AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  Exam,
  ExamAttempt,
  type ExamQuestionDoc,
  type HydratedExam,
  type HydratedExamAttempt,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import {
  assertFacultyOwnsCourse,
  assertStudentEnrolledInCourse,
} from './authzService.js';
import { nowUtc } from './clockService.js';
import { gradeMcqAnswers } from './assessmentScoring.js';

export interface ExamCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export function toExamDto(doc: HydratedExam): ExamDto {
  return {
    id: doc._id.toString(),
    courseId: doc.courseId.toString(),
    title: doc.title,
    durationMinutes: doc.durationMinutes,
    maxAttempts: doc.maxAttempts,
    passingPercent: doc.passingPercent,
    questions: doc.questions.map((q) => ({
      text: q.text,
      kind: q.kind,
      options: [...q.options],
      correctIndices: [...q.correctIndices],
      points: q.points,
      rubricId: q.rubricId ? q.rubricId.toString() : null,
      wordLimit: q.wordLimit,
    })),
    state: doc.state,
    openAt: doc.openAt ? doc.openAt.toISOString() : null,
    closeAt: doc.closeAt ? doc.closeAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toStudentExamDto(doc: HydratedExam): StudentExamDto {
  return {
    id: doc._id.toString(),
    courseId: doc.courseId.toString(),
    title: doc.title,
    durationMinutes: doc.durationMinutes,
    maxAttempts: doc.maxAttempts,
    passingPercent: doc.passingPercent,
    questions: doc.questions.map((q) => ({
      text: q.text,
      kind: q.kind,
      options: q.kind === 'essay' ? [] : [...q.options],
      points: q.points,
      wordLimit: q.wordLimit,
    })),
    state: doc.state,
    openAt: doc.openAt ? doc.openAt.toISOString() : null,
    closeAt: doc.closeAt ? doc.closeAt.toISOString() : null,
  };
}

export function toExamAttemptDto(doc: HydratedExamAttempt): ExamAttemptDto {
  return {
    id: doc._id.toString(),
    examId: doc.examId.toString(),
    studentId: doc.studentId.toString(),
    startedAt: doc.startedAt.toISOString(),
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    answers: doc.answers.map((a) => ({
      questionIndex: a.questionIndex,
      chosenIndices: [...a.chosenIndices],
    })),
    essayAnswers: doc.essayAnswers.map((e) => ({
      questionIndex: e.questionIndex,
      text: e.text,
    })),
    mcqScorePercent: doc.mcqScorePercent,
    essayScorePercent: doc.essayScorePercent,
    totalScorePercent: doc.totalScorePercent,
    passed: doc.passed,
    grades: doc.grades.map((g) => ({
      questionIndex: g.questionIndex,
      score: g.score,
      comment: g.comment,
      rubricScores: g.rubricScores.map((r) => ({
        criterionIndex: r.criterionIndex,
        score: r.score,
        label: r.label,
      })),
    })),
    graderUserId: doc.graderUserId ? doc.graderUserId.toString() : null,
    gradedAt: doc.gradedAt ? doc.gradedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizeQuestion(q: ExamQuestionDto): ExamQuestionDoc {
  if (q.points < 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Question points must be >= 0.');
  }
  if (q.kind === 'essay') {
    return {
      text: q.text,
      kind: 'essay',
      options: [],
      correctIndices: [],
      points: q.points,
      rubricId: q.rubricId ? new Types.ObjectId(q.rubricId) : null,
      wordLimit: q.wordLimit ?? null,
    };
  }
  if (!q.options || q.options.length < 2) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'MCQ must have at least 2 options.');
  }
  const maxIdx = q.options.length - 1;
  const seen = new Set<number>();
  q.correctIndices.forEach((idx) => {
    if (!Number.isInteger(idx) || idx < 0 || idx > maxIdx) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'correctIndices out of range.');
    }
    seen.add(idx);
  });
  if (seen.size !== q.correctIndices.length) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'correctIndices contains duplicates.');
  }
  if (q.kind === 'mcq_single' && q.correctIndices.length !== 1) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'mcq_single must have exactly one correct index.',
    );
  }
  if (q.kind === 'mcq_multi' && q.correctIndices.length < 1) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'mcq_multi must have at least one correct index.',
    );
  }
  return {
    text: q.text,
    kind: q.kind,
    options: [...q.options],
    correctIndices: [...q.correctIndices],
    points: q.points,
    rubricId: null,
    wordLimit: null,
  };
}

const EXAM_TRANSITIONS: Record<QuizState, readonly QuizState[]> = {
  draft: ['draft', 'scheduled', 'live'],
  scheduled: ['scheduled', 'live', 'draft'],
  live: ['live', 'closed'],
  closed: ['closed'],
};

function assertValidStateTransition(from: QuizState, to: QuizState): void {
  if (!EXAM_TRANSITIONS[from].includes(to)) {
    throw new HttpError(
      409,
      'ASSESSMENT_STATE_INVALID',
      `Illegal exam state transition: ${from} → ${to}.`,
    );
  }
}

export async function createExam(
  actor: AuthContext,
  input: CreateExamInput,
  ctx: ExamCtx,
): Promise<HydratedExam> {
  if (!Types.ObjectId.isValid(input.courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, input.courseId);
  if (!input.questions || input.questions.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'An exam needs at least one question.');
  }
  const questions = input.questions.map(normalizeQuestion);

  const exam = await Exam.create({
    courseId: new Types.ObjectId(input.courseId),
    title: input.title,
    durationMinutes: input.durationMinutes ?? 120,
    maxAttempts: input.maxAttempts ?? 1,
    passingPercent: input.passingPercent ?? 50,
    questions,
    state: 'draft',
    openAt: input.openAt ? new Date(input.openAt) : null,
    closeAt: input.closeAt ? new Date(input.closeAt) : null,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'exam.created',
    targetType: 'Exam',
    targetId: exam._id,
    after: exam.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return exam;
}

export async function updateExam(
  actor: AuthContext,
  examId: string,
  input: UpdateExamInput,
  ctx: ExamCtx,
): Promise<HydratedExam> {
  if (!Types.ObjectId.isValid(examId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, exam.courseId);
  const before = exam.toJSON();
  const previousState = exam.state;

  if (input.title !== undefined) exam.title = input.title;
  if (input.durationMinutes !== undefined) exam.durationMinutes = input.durationMinutes;
  if (input.maxAttempts !== undefined) {
    if (input.maxAttempts < 1) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'maxAttempts must be >= 1.');
    }
    exam.maxAttempts = input.maxAttempts;
  }
  if (input.passingPercent !== undefined) {
    if (input.passingPercent < 0 || input.passingPercent > 100) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'passingPercent must be 0..100.');
    }
    exam.passingPercent = input.passingPercent;
  }
  if (input.questions !== undefined) {
    if (input.questions.length === 0) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'An exam needs at least one question.');
    }
    exam.questions = input.questions.map(normalizeQuestion) as ExamQuestionDoc[];
  }
  if (input.state !== undefined) {
    assertValidStateTransition(previousState, input.state);
    exam.state = input.state;
  }
  if (input.openAt !== undefined) {
    exam.openAt = input.openAt ? new Date(input.openAt) : null;
  }
  if (input.closeAt !== undefined) {
    exam.closeAt = input.closeAt ? new Date(input.closeAt) : null;
  }

  await exam.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: input.state && input.state !== previousState ? 'exam.state_changed' : 'exam.updated',
    targetType: 'Exam',
    targetId: exam._id,
    before,
    after: exam.toJSON(),
    details: input.state ? { from: previousState, to: input.state } : null,
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return exam;
}

export async function getExamForStaff(
  actor: AuthContext,
  examId: string,
): Promise<HydratedExam> {
  if (!Types.ObjectId.isValid(examId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  if (actor.role === 'faculty') {
    await assertFacultyOwnsCourse(actor.userId, actor.role, exam.courseId);
  } else if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Role not permitted.');
  }
  return exam;
}

export async function getExamForStudent(
  actor: AuthContext,
  examId: string,
): Promise<HydratedExam> {
  if (!Types.ObjectId.isValid(examId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  await assertStudentEnrolledInCourse(actor.userId, exam.courseId);
  if (exam.state !== 'live') {
    throw new HttpError(409, 'ASSESSMENT_NOT_LIVE', 'Exam is not currently live.');
  }
  return exam;
}

function assertWithinWindow(exam: HydratedExam, now: Date): void {
  if (exam.openAt && now < exam.openAt) {
    throw new HttpError(409, 'ASSESSMENT_NOT_OPEN', 'Exam has not opened yet.');
  }
  if (exam.closeAt && now > exam.closeAt) {
    throw new HttpError(409, 'ASSESSMENT_CLOSED', 'Exam window has closed.');
  }
}

export async function startExamAttempt(
  actor: AuthContext,
  examId: string,
  ctx: ExamCtx,
): Promise<HydratedExamAttempt> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may start an exam attempt.');
  }
  const exam = await getExamForStudent(actor, examId);
  const now = nowUtc();
  assertWithinWindow(exam, now);

  const inProgress = await ExamAttempt.findOne({
    examId: exam._id,
    studentId: actor.userId,
    submittedAt: null,
  });
  if (inProgress) return inProgress;

  const submittedCount = await ExamAttempt.countDocuments({
    examId: exam._id,
    studentId: actor.userId,
    submittedAt: { $ne: null },
  });
  if (submittedCount >= exam.maxAttempts) {
    throw new HttpError(
      409,
      'ASSESSMENT_ATTEMPTS_EXHAUSTED',
      'Maximum attempts reached for this exam.',
    );
  }

  const attempt = await ExamAttempt.create({
    examId: exam._id,
    studentId: actor.userId,
    startedAt: now,
    submittedAt: null,
    answers: [],
    essayAnswers: [],
    mcqScorePercent: null,
    essayScorePercent: null,
    totalScorePercent: null,
    passed: null,
    grades: [],
    graderUserId: null,
    gradedAt: null,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'exam.attempt.started',
    targetType: 'ExamAttempt',
    targetId: attempt._id,
    details: { examId: exam._id.toString() },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return attempt;
}

export async function submitExamAttempt(
  actor: AuthContext,
  attemptId: string,
  input: SubmitExamAttemptInput,
  ctx: ExamCtx,
): Promise<HydratedExamAttempt> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may submit exam attempts.');
  }
  if (!Types.ObjectId.isValid(attemptId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam attempt not found.');
  }
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam attempt not found.');
  }
  if (!attempt.studentId.equals(actor.userId)) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your attempt.');
  }
  if (attempt.submittedAt) {
    throw new HttpError(409, 'ASSESSMENT_ALREADY_SUBMITTED', 'Attempt already submitted.');
  }

  const exam = await Exam.findById(attempt.examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }

  const now = nowUtc();
  const answers = (input.answers ?? []).map((a) => ({
    questionIndex: a.questionIndex,
    chosenIndices: [...(a.chosenIndices ?? [])],
  }));
  const essayAnswers = (input.essayAnswers ?? []).map((e) => ({
    questionIndex: e.questionIndex,
    text: e.text,
  }));

  const mcqResult = gradeMcqAnswers(exam.questions, answers);
  const hasEssay = exam.questions.some((q) => q.kind === 'essay');

  attempt.answers = answers;
  attempt.essayAnswers = essayAnswers;
  attempt.submittedAt = now;
  attempt.mcqScorePercent = Math.round(mcqResult.mcqScorePercent * 100) / 100;
  // Essay scoring is pending manual grading; total + passed stay null.
  attempt.essayScorePercent = null;
  attempt.totalScorePercent = hasEssay ? null : attempt.mcqScorePercent;
  attempt.passed = hasEssay ? null : attempt.mcqScorePercent >= exam.passingPercent;
  await attempt.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'exam.attempt.submitted',
    targetType: 'ExamAttempt',
    targetId: attempt._id,
    details: {
      examId: exam._id.toString(),
      mcqScorePercent: attempt.mcqScorePercent,
      hasEssay,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return attempt;
}

export async function listAttemptsForStudentExam(
  actor: AuthContext,
  examId: string,
): Promise<HydratedExamAttempt[]> {
  if (!Types.ObjectId.isValid(examId)) return [];
  return ExamAttempt.find({
    examId,
    studentId: actor.userId,
  }).sort({ createdAt: 1 });
}
