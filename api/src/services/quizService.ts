import { Types } from 'mongoose';
import type {
  CreateQuizInput,
  QuizAttemptDto,
  QuizDto,
  QuizQuestionDto,
  QuizState,
  StudentQuizDto,
  SubmitQuizAttemptInput,
  UpdateQuizInput,
} from 'india-learns-shared-types';
import type { AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  ModuleModel,
  Quiz,
  QuizAttempt,
  type HydratedQuiz,
  type HydratedQuizAttempt,
  type QuizQuestionDoc,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import {
  assertFacultyOwnsCourse,
  assertStudentEnrolledInCourse,
} from './authzService.js';
import { nowUtc } from './clockService.js';
import { gradeMcqAnswers } from './assessmentScoring.js';
import { checkAllActiveEnrolmentsForStudentCourse } from './courseCompletionService.js';

export interface QuizCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export function toQuizDto(doc: HydratedQuiz): QuizDto {
  return {
    id: doc._id.toString(),
    moduleId: doc.moduleId.toString(),
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
    })),
    state: doc.state,
    openAt: doc.openAt ? doc.openAt.toISOString() : null,
    closeAt: doc.closeAt ? doc.closeAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// Student-facing projection strips correct answers so the wire never carries
// them alongside an in-progress attempt.
export function toStudentQuizDto(doc: HydratedQuiz): StudentQuizDto {
  return {
    id: doc._id.toString(),
    moduleId: doc.moduleId.toString(),
    title: doc.title,
    durationMinutes: doc.durationMinutes,
    maxAttempts: doc.maxAttempts,
    passingPercent: doc.passingPercent,
    questions: doc.questions.map((q) => ({
      text: q.text,
      kind: q.kind,
      options: [...q.options],
      points: q.points,
    })),
    state: doc.state,
    openAt: doc.openAt ? doc.openAt.toISOString() : null,
    closeAt: doc.closeAt ? doc.closeAt.toISOString() : null,
  };
}

export function toQuizAttemptDto(doc: HydratedQuizAttempt): QuizAttemptDto {
  return {
    id: doc._id.toString(),
    quizId: doc.quizId.toString(),
    studentId: doc.studentId.toString(),
    startedAt: doc.startedAt.toISOString(),
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    answers: doc.answers.map((a) => ({
      questionIndex: a.questionIndex,
      chosenIndices: [...a.chosenIndices],
    })),
    scorePercent: doc.scorePercent,
    passed: doc.passed,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizeQuestion(q: QuizQuestionDto): QuizQuestionDoc {
  if (q.points < 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Question points must be >= 0.');
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
  };
}

async function resolveModuleAndCourse(moduleId: string): Promise<{
  moduleDoc: Awaited<ReturnType<typeof ModuleModel.findById>>;
  courseId: Types.ObjectId;
}> {
  if (!Types.ObjectId.isValid(moduleId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  }
  const moduleDoc = await ModuleModel.findById(moduleId);
  if (!moduleDoc || moduleDoc.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  }
  return { moduleDoc, courseId: moduleDoc.courseId };
}

export async function createQuiz(
  actor: AuthContext,
  input: CreateQuizInput,
  ctx: QuizCtx,
): Promise<HydratedQuiz> {
  const { courseId } = await resolveModuleAndCourse(input.moduleId);
  await assertFacultyOwnsCourse(actor.userId, actor.role, courseId);

  if (!input.questions || input.questions.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'A quiz needs at least one question.');
  }
  const questions = input.questions.map(normalizeQuestion);

  const quiz = await Quiz.create({
    moduleId: new Types.ObjectId(input.moduleId),
    title: input.title,
    durationMinutes: input.durationMinutes ?? null,
    maxAttempts: input.maxAttempts ?? 3,
    passingPercent: input.passingPercent ?? 60,
    questions,
    state: 'draft',
    openAt: input.openAt ? new Date(input.openAt) : null,
    closeAt: input.closeAt ? new Date(input.closeAt) : null,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'quiz.created',
    targetType: 'Quiz',
    targetId: quiz._id,
    after: quiz.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return quiz;
}

export async function updateQuiz(
  actor: AuthContext,
  quizId: string,
  input: UpdateQuizInput,
  ctx: QuizCtx,
): Promise<HydratedQuiz> {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  const { courseId } = await resolveModuleAndCourse(quiz.moduleId.toString());
  await assertFacultyOwnsCourse(actor.userId, actor.role, courseId);

  const before = quiz.toJSON();
  const previousState = quiz.state;

  if (input.title !== undefined) quiz.title = input.title;
  if (input.durationMinutes !== undefined) quiz.durationMinutes = input.durationMinutes;
  if (input.maxAttempts !== undefined) {
    if (input.maxAttempts < 1) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'maxAttempts must be >= 1.');
    }
    quiz.maxAttempts = input.maxAttempts;
  }
  if (input.passingPercent !== undefined) {
    if (input.passingPercent < 0 || input.passingPercent > 100) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'passingPercent must be 0..100.');
    }
    quiz.passingPercent = input.passingPercent;
  }
  if (input.questions !== undefined) {
    if (input.questions.length === 0) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'A quiz needs at least one question.');
    }
    quiz.questions = input.questions.map(normalizeQuestion) as QuizQuestionDoc[];
  }
  if (input.state !== undefined) {
    assertValidStateTransition(previousState, input.state);
    quiz.state = input.state;
  }
  if (input.openAt !== undefined) {
    quiz.openAt = input.openAt ? new Date(input.openAt) : null;
  }
  if (input.closeAt !== undefined) {
    quiz.closeAt = input.closeAt ? new Date(input.closeAt) : null;
  }

  await quiz.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: input.state && input.state !== previousState ? 'quiz.state_changed' : 'quiz.updated',
    targetType: 'Quiz',
    targetId: quiz._id,
    before,
    after: quiz.toJSON(),
    details: input.state ? { from: previousState, to: input.state } : null,
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return quiz;
}

// PRD §12.2: Draft → Scheduled → Live → Closed. We also allow Live → Closed
// directly (common path) and Closed is terminal (no further transitions).
const QUIZ_TRANSITIONS: Record<QuizState, readonly QuizState[]> = {
  draft: ['draft', 'scheduled', 'live'],
  scheduled: ['scheduled', 'live', 'draft'],
  live: ['live', 'closed'],
  closed: ['closed'],
};

function assertValidStateTransition(from: QuizState, to: QuizState): void {
  if (!QUIZ_TRANSITIONS[from].includes(to)) {
    throw new HttpError(
      409,
      'ASSESSMENT_STATE_INVALID',
      `Illegal quiz state transition: ${from} → ${to}.`,
    );
  }
}

export async function getQuizForStaff(
  actor: AuthContext,
  quizId: string,
): Promise<HydratedQuiz> {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  if (actor.role === 'faculty') {
    const { courseId } = await resolveModuleAndCourse(quiz.moduleId.toString());
    await assertFacultyOwnsCourse(actor.userId, actor.role, courseId);
  } else if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Role not permitted.');
  }
  return quiz;
}

export async function getQuizForStudent(
  actor: AuthContext,
  quizId: string,
): Promise<HydratedQuiz> {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }
  const { courseId } = await resolveModuleAndCourse(quiz.moduleId.toString());
  await assertStudentEnrolledInCourse(actor.userId, courseId);
  if (quiz.state !== 'live') {
    throw new HttpError(409, 'ASSESSMENT_NOT_LIVE', 'Quiz is not currently live.');
  }
  return quiz;
}

function assertWithinWindow(quiz: HydratedQuiz, now: Date): void {
  if (quiz.openAt && now < quiz.openAt) {
    throw new HttpError(409, 'ASSESSMENT_NOT_OPEN', 'Quiz has not opened yet.');
  }
  if (quiz.closeAt && now > quiz.closeAt) {
    throw new HttpError(409, 'ASSESSMENT_CLOSED', 'Quiz window has closed.');
  }
}

export async function startAttempt(
  actor: AuthContext,
  quizId: string,
  ctx: QuizCtx,
): Promise<HydratedQuizAttempt> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may start a quiz attempt.');
  }
  const quiz = await getQuizForStudent(actor, quizId);
  const now = nowUtc();
  assertWithinWindow(quiz, now);

  const inProgress = await QuizAttempt.findOne({
    quizId: quiz._id,
    studentId: actor.userId,
    submittedAt: null,
  });
  if (inProgress) {
    // Resume the same attempt rather than opening a second.
    return inProgress;
  }

  const submittedCount = await QuizAttempt.countDocuments({
    quizId: quiz._id,
    studentId: actor.userId,
    submittedAt: { $ne: null },
  });
  if (submittedCount >= quiz.maxAttempts) {
    throw new HttpError(
      409,
      'ASSESSMENT_ATTEMPTS_EXHAUSTED',
      'Maximum attempts reached for this quiz.',
    );
  }

  const attempt = await QuizAttempt.create({
    quizId: quiz._id,
    studentId: actor.userId,
    startedAt: now,
    submittedAt: null,
    answers: [],
    scorePercent: null,
    passed: null,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'quiz.attempt.started',
    targetType: 'QuizAttempt',
    targetId: attempt._id,
    details: { quizId: quiz._id.toString() },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return attempt;
}

export async function submitAttempt(
  actor: AuthContext,
  attemptId: string,
  input: SubmitQuizAttemptInput,
  ctx: QuizCtx,
): Promise<HydratedQuizAttempt> {
  if (actor.role !== 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Only students may submit quiz attempts.');
  }
  if (!Types.ObjectId.isValid(attemptId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz attempt not found.');
  }
  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz attempt not found.');
  }
  if (!attempt.studentId.equals(actor.userId)) {
    throw new HttpError(403, 'FORBIDDEN', 'Not your attempt.');
  }
  if (attempt.submittedAt) {
    throw new HttpError(409, 'ASSESSMENT_ALREADY_SUBMITTED', 'Attempt already submitted.');
  }

  const quiz = await Quiz.findById(attempt.quizId);
  if (!quiz) {
    throw new HttpError(404, 'NOT_FOUND', 'Quiz not found.');
  }

  const now = nowUtc();
  const answers = (input.answers ?? []).map((a) => ({
    questionIndex: a.questionIndex,
    chosenIndices: [...(a.chosenIndices ?? [])],
  }));

  const result = gradeMcqAnswers(quiz.questions, answers);
  const passed = result.mcqScorePercent >= quiz.passingPercent;

  attempt.answers = answers;
  attempt.submittedAt = now;
  attempt.scorePercent = Math.round(result.mcqScorePercent * 100) / 100;
  attempt.passed = passed;
  await attempt.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'quiz.attempt.submitted',
    targetType: 'QuizAttempt',
    targetId: attempt._id,
    details: {
      quizId: quiz._id.toString(),
      scorePercent: attempt.scorePercent,
      passed,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // On a passing quiz, check whether the enrolment is now fully complete.
  if (passed) {
    const moduleDoc = await ModuleModel.findById(quiz.moduleId).select('courseId');
    if (moduleDoc) {
      try {
        await checkAllActiveEnrolmentsForStudentCourse(
          actor.userId,
          moduleDoc.courseId,
        );
      } catch {
        // Non-fatal — completion check isn't load-bearing on the submit flow.
      }
    }
  }

  return attempt;
}

export async function listAttemptsForStudent(
  actor: AuthContext,
  quizId: string,
): Promise<HydratedQuizAttempt[]> {
  if (!Types.ObjectId.isValid(quizId)) return [];
  const attempts = await QuizAttempt.find({
    quizId,
    studentId: actor.userId,
  }).sort({ createdAt: 1 });
  return attempts;
}
