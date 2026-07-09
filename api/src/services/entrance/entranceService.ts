import type { Types } from 'mongoose';
import type {
  EntranceCandidateStateDto,
  EntranceLoginResponse,
  SaveEntranceAnswerInput,
} from 'india-learns-shared-types';
import {
  EntranceAttempt,
  EntranceCandidate,
  EntranceExam,
  type EntranceAttemptDoc,
  type EntranceExamDoc,
  type HydratedEntranceAttempt,
  type HydratedEntranceCandidate,
  type HydratedEntranceExam,
} from '../../models/index.js';
import { HttpError } from '../../middleware/error.js';
import { verifyPassword } from '../passwordService.js';
import { recordAudit } from '../auditService.js';
import { signEntranceToken } from './entranceToken.js';
import {
  attemptDeadline,
  computeAutoScore,
  manualPossibleMarks,
  toAttemptSelfDto,
  toCandidatePublicDto,
  toExamPublicDto,
} from './entranceMapping.js';

export interface EntranceCtx {
  ip: string;
  ua: string;
}

/** Digits-only. Phone is the username, so lookups must be exact. */
export function normalizePhone(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

function assertExamOpen(exam: EntranceExamDoc): void {
  const now = Date.now();
  if (exam.state !== 'live') {
    throw new HttpError(
      403,
      'ENTRANCE_WINDOW_CLOSED',
      'The entrance exam is not currently open.',
    );
  }
  if (exam.opensAt && now < new Date(exam.opensAt).getTime()) {
    throw new HttpError(
      403,
      'ENTRANCE_NOT_OPEN_YET',
      'The entrance exam has not opened yet.',
    );
  }
  if (exam.closesAt && now > new Date(exam.closesAt).getTime()) {
    throw new HttpError(
      403,
      'ENTRANCE_WINDOW_CLOSED',
      'The entrance exam window has closed.',
    );
  }
}

async function loadCandidate(candidateId: string | Types.ObjectId): Promise<HydratedEntranceCandidate> {
  const candidate = await EntranceCandidate.findById(candidateId);
  if (!candidate || !candidate.active) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Entrance login is no longer valid.');
  }
  return candidate;
}

async function loadExam(examId: Types.ObjectId): Promise<HydratedEntranceExam> {
  const exam = await EntranceExam.findById(examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Entrance exam not found.');
  }
  return exam;
}

export async function loginCandidate(
  phoneInput: string,
  password: string,
  ctx: EntranceCtx,
): Promise<EntranceLoginResponse> {
  const phone = normalizePhone(phoneInput);
  const candidate = await EntranceCandidate.findOne({ phone, active: true });
  // Verify a hash regardless to keep timing roughly constant and avoid leaking
  // which phone numbers are registered.
  const ok = await verifyPassword(candidate?.passwordHash, password);
  if (!candidate || !ok) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect phone number or password.');
  }

  const exam = await loadExam(candidate.examId);
  const attempts = await EntranceAttempt.find({ candidateId: candidate._id });
  const inProgress = attempts.find((a) => a.status === 'in_progress') ?? null;
  const attemptsUsed = attempts.filter(
    (a) => a.status === 'submitted' || a.status === 'graded',
  ).length;

  // Allow login while the window is open, OR when the candidate has a live,
  // not-yet-expired attempt to resume — so a dropped connection mid-exam never
  // locks them out of their own in-flight paper.
  const canResume =
    inProgress != null &&
    Date.now() < attemptDeadline(inProgress.startedAt, exam.durationMinutes).getTime();
  if (!canResume) {
    assertExamOpen(exam);
  }

  const { token, expiresIn } = await signEntranceToken(candidate);

  await recordAudit({
    actorUserId: null,
    action: 'entrance.candidate.login',
    targetType: 'EntranceCandidate',
    targetId: candidate._id,
    details: { candidateId: String(candidate._id), phone: candidate.phone },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return {
    candidate: toCandidatePublicDto(candidate),
    exam: toExamPublicDto(exam),
    token,
    tokenExpiresIn: expiresIn,
    attempt: inProgress ? toAttemptSelfDto(inProgress, exam) : null,
    attemptsUsed,
    maxAttempts: exam.maxAttempts,
  };
}

/** Current exam + this candidate's in-progress attempt + attempt allowance. */
export async function getCandidateState(
  candidateId: string,
): Promise<EntranceCandidateStateDto> {
  const candidate = await loadCandidate(candidateId);
  const exam = await loadExam(candidate.examId);
  const attempts = await EntranceAttempt.find({ candidateId: candidate._id });
  const inProgress = attempts.find((a) => a.status === 'in_progress') ?? null;
  const attemptsUsed = attempts.filter(
    (a) => a.status === 'submitted' || a.status === 'graded',
  ).length;
  return {
    exam: toExamPublicDto(exam),
    attempt: inProgress ? toAttemptSelfDto(inProgress, exam) : null,
    attemptsUsed,
    maxAttempts: exam.maxAttempts,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 11000,
  );
}

/** Finalize an in-progress attempt: auto-score MCQs, mark submitted. */
async function finalizeAttempt(
  attempt: HydratedEntranceAttempt,
  exam: EntranceExamDoc,
  auto: boolean,
): Promise<{ hasTextQuestions: boolean }> {
  const { autoScoreMarks, hasTextQuestions } = computeAutoScore(exam, attempt.answers);
  attempt.autoScoreMarks = autoScoreMarks;
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = auto;
  attempt.status = 'submitted';
  if (!hasTextQuestions) {
    attempt.manualScoreMarks = 0;
    attempt.totalScoreMarks = autoScoreMarks;
  }
  await attempt.save();
  return { hasTextQuestions };
}

export async function startAttempt(candidateId: string, ctx: EntranceCtx) {
  const candidate = await loadCandidate(candidateId);
  const exam = await loadExam(candidate.examId);

  const attempts = await EntranceAttempt.find({ candidateId: candidate._id });
  const inProgress = attempts.find((a) => a.status === 'in_progress');
  if (inProgress) {
    const expired =
      Date.now() >= attemptDeadline(inProgress.startedAt, exam.durationMinutes).getTime();
    if (!expired) {
      // Idempotent resume of a live in-progress attempt.
      return toAttemptSelfDto(inProgress, exam);
    }
    // Deadline passed with no submit (e.g. the candidate closed the tab) —
    // auto-submit it so it is scored + counted, then start a fresh attempt.
    await finalizeAttempt(inProgress, exam, true);
  }

  const attemptsUsed =
    attempts.filter((a) => a.status === 'submitted' || a.status === 'graded').length +
    (inProgress ? 1 : 0);
  if (attemptsUsed >= exam.maxAttempts) {
    throw new HttpError(
      409,
      'ENTRANCE_ATTEMPTS_EXHAUSTED',
      `You have used all ${exam.maxAttempts} attempts for this exam.`,
    );
  }

  assertExamOpen(exam);

  try {
    const attempt = await EntranceAttempt.create({
      examId: exam._id,
      candidateId: candidate._id,
      attemptNumber: attempts.length + 1,
      status: 'in_progress',
      startedAt: new Date(),
      answers: [],
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    await recordAudit({
      actorUserId: null,
      action: 'entrance.attempt.started',
      targetType: 'EntranceAttempt',
      targetId: attempt._id,
      details: {
        candidateId: String(candidate._id),
        examId: String(exam._id),
        attemptNumber: attempt.attemptNumber,
      },
      ip: ctx.ip,
      ua: ctx.ua,
    });

    return toAttemptSelfDto(attempt, exam);
  } catch (err) {
    // Concurrent double-click: the unique {candidateId, attemptNumber} index
    // rejected the loser — resolve to the winning in-progress attempt.
    if (isDuplicateKeyError(err)) {
      const winner = await EntranceAttempt.findOne({
        candidateId: candidate._id,
        status: 'in_progress',
      });
      if (winner) return toAttemptSelfDto(winner, exam);
    }
    throw err;
  }
}

function mergeAnswers(
  attempt: HydratedEntranceAttempt,
  exam: EntranceExamDoc,
  inputs: SaveEntranceAnswerInput[],
): void {
  const byIndex = new Map<number, EntranceAttemptDoc['answers'][number]>(
    attempt.answers.map((a) => [a.questionIndex, a]),
  );
  const now = new Date();
  for (const input of inputs) {
    const q = exam.questions[input.questionIndex];
    if (!q) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Unknown question index.');
    }
    let selectedIndex: number | null = null;
    if (q.kind === 'mcq' && input.selectedIndex !== undefined && input.selectedIndex !== null) {
      if (input.selectedIndex < 0 || input.selectedIndex >= q.options.length) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Selected option out of range.');
      }
      selectedIndex = input.selectedIndex;
    }
    const textAnswer =
      q.kind === 'text' && typeof input.textAnswer === 'string' ? input.textAnswer : '';

    byIndex.set(input.questionIndex, {
      questionIndex: input.questionIndex,
      selectedIndex: q.kind === 'mcq' ? selectedIndex : null,
      textAnswer: q.kind === 'text' ? textAnswer : '',
      answeredAt: now,
    });
  }
  attempt.answers = [...byIndex.values()].sort((a, b) => a.questionIndex - b.questionIndex);
}

export async function saveAnswers(
  candidateId: string,
  inputs: SaveEntranceAnswerInput[],
) {
  const candidate = await loadCandidate(candidateId);
  const exam = await loadExam(candidate.examId);
  const attempt = await EntranceAttempt.findOne({
    candidateId: candidate._id,
    status: 'in_progress',
  });
  if (!attempt) {
    throw new HttpError(
      409,
      'ENTRANCE_NO_ACTIVE_ATTEMPT',
      'No exam is in progress. Start an attempt first.',
    );
  }
  // Durability-first: accept autosaves for the whole in-progress lifetime. The
  // 45-min deadline and admin window gate START, not the incremental saves, so
  // a candidate never loses typed data to a boundary race.
  mergeAnswers(attempt, exam, inputs);
  await attempt.save();
  return toAttemptSelfDto(attempt, exam);
}

export async function submitAttempt(
  candidateId: string,
  inputs: SaveEntranceAnswerInput[] | undefined,
  ctx: EntranceCtx & { auto?: boolean },
) {
  const candidate = await loadCandidate(candidateId);
  const exam = await loadExam(candidate.examId);
  const attempt = await EntranceAttempt.findOne({
    candidateId: candidate._id,
    status: 'in_progress',
  });
  if (!attempt) {
    throw new HttpError(
      409,
      'ENTRANCE_NO_ACTIVE_ATTEMPT',
      'No exam is in progress to submit.',
    );
  }

  // Merge any final client state so the submit captures the latest answers even
  // if the last autosave was in flight.
  if (inputs && inputs.length > 0) {
    mergeAnswers(attempt, exam, inputs);
  }

  const { hasTextQuestions } = await finalizeAttempt(attempt, exam, Boolean(ctx.auto));

  await recordAudit({
    actorUserId: null,
    action: 'entrance.attempt.submitted',
    targetType: 'EntranceAttempt',
    targetId: attempt._id,
    details: {
      candidateId: String(candidate._id),
      autoSubmitted: attempt.autoSubmitted,
      manualGradePending: hasTextQuestions,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return toAttemptSelfDto(attempt, exam);
}

/** Exposed for the admin service / tests. */
export { manualPossibleMarks };
