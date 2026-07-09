import type {
  EntranceAttemptAdminDto,
  EntranceAttemptAnswerAdminDto,
  EntranceAttemptSelfDto,
  EntranceCandidatePublicDto,
  EntranceCandidateRowDto,
  EntranceCandidateStatus,
  EntranceExamAdminDto,
  EntranceExamPublicDto,
} from 'india-learns-shared-types';
import type {
  EntranceAttemptDoc,
  EntranceCandidateDoc,
  EntranceExamDoc,
} from '../../models/index.js';

const iso = (d: Date | null | undefined): string | null =>
  d ? new Date(d).toISOString() : null;

/** Deadline for a candidate's attempt: start + the exam's per-attempt duration. */
export function attemptDeadline(startedAt: Date, durationMinutes: number): Date {
  return new Date(new Date(startedAt).getTime() + durationMinutes * 60_000);
}

/**
 * Auto-score the MCQ questions against the answer key. `text` questions never
 * contribute here — they are graded manually. Returns the auto marks and
 * whether any manual (text) grading is still owed.
 */
export function computeAutoScore(
  exam: Pick<EntranceExamDoc, 'questions'>,
  answers: EntranceAttemptDoc['answers'],
): { autoScoreMarks: number; hasTextQuestions: boolean } {
  const byIndex = new Map(answers.map((a) => [a.questionIndex, a]));
  let autoScoreMarks = 0;
  let hasTextQuestions = false;
  exam.questions.forEach((q, i) => {
    if (q.kind === 'text') {
      hasTextQuestions = true;
      return;
    }
    const a = byIndex.get(i);
    if (
      a &&
      a.selectedIndex !== null &&
      q.correctIndex !== null &&
      a.selectedIndex === q.correctIndex
    ) {
      autoScoreMarks += q.points;
    }
  });
  return { autoScoreMarks, hasTextQuestions };
}

/** Sum of points on questions that require manual (text) grading. */
export function manualPossibleMarks(exam: Pick<EntranceExamDoc, 'questions'>): number {
  return exam.questions
    .filter((q) => q.kind === 'text')
    .reduce((sum, q) => sum + q.points, 0);
}

export function toExamPublicDto(exam: EntranceExamDoc): EntranceExamPublicDto {
  return {
    id: String(exam._id),
    title: exam.title,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    state: exam.state,
    opensAt: iso(exam.opensAt),
    closesAt: iso(exam.closesAt),
    questions: exam.questions.map((q, index) => ({
      index,
      section: q.section,
      text: q.text,
      kind: q.kind,
      options: q.options,
      points: q.points,
    })),
  };
}

export function toExamAdminDto(exam: EntranceExamDoc): EntranceExamAdminDto {
  return {
    id: String(exam._id),
    title: exam.title,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    state: exam.state,
    opensAt: iso(exam.opensAt),
    closesAt: iso(exam.closesAt),
    questions: exam.questions.map((q, index) => ({
      index,
      section: q.section,
      text: q.text,
      kind: q.kind,
      options: q.options,
      points: q.points,
      correctIndex: q.correctIndex,
    })),
    createdAt: new Date(exam.createdAt).toISOString(),
    updatedAt: new Date(exam.updatedAt).toISOString(),
  };
}

export function toCandidatePublicDto(
  candidate: EntranceCandidateDoc,
): EntranceCandidatePublicDto {
  return { id: String(candidate._id), name: candidate.name, phone: candidate.phone };
}

export function toAttemptSelfDto(
  attempt: EntranceAttemptDoc,
  exam: Pick<EntranceExamDoc, 'durationMinutes'>,
): EntranceAttemptSelfDto {
  return {
    id: String(attempt._id),
    status: attempt.status,
    startedAt: new Date(attempt.startedAt).toISOString(),
    submittedAt: iso(attempt.submittedAt),
    deadlineAt: attemptDeadline(attempt.startedAt, exam.durationMinutes).toISOString(),
    answers: attempt.answers.map((a) => ({
      questionIndex: a.questionIndex,
      selectedIndex: a.selectedIndex,
      textAnswer: a.textAnswer,
      answeredAt: iso(a.answeredAt),
    })),
  };
}

function candidateStatus(attempt: EntranceAttemptDoc | null): EntranceCandidateStatus {
  if (!attempt) return 'not_started';
  return attempt.status;
}

export function toCandidateRowDto(
  candidate: EntranceCandidateDoc,
  exam: EntranceExamDoc,
  attempt: EntranceAttemptDoc | null,
): EntranceCandidateRowDto {
  const submitted = attempt?.status === 'submitted' || attempt?.status === 'graded';
  const hasText = manualPossibleMarks(exam) > 0;
  return {
    id: String(candidate._id),
    name: candidate.name,
    phone: candidate.phone,
    active: candidate.active,
    status: candidateStatus(attempt),
    startedAt: attempt ? new Date(attempt.startedAt).toISOString() : null,
    submittedAt: attempt ? iso(attempt.submittedAt) : null,
    autoScoreMarks: submitted ? (attempt?.autoScoreMarks ?? 0) : null,
    manualScoreMarks: attempt?.manualScoreMarks ?? null,
    totalScoreMarks: attempt?.totalScoreMarks ?? null,
    totalMarks: exam.totalMarks,
    pendingManualGrade:
      Boolean(submitted && hasText && attempt?.status !== 'graded'),
  };
}

export function toAttemptAdminDto(
  attempt: EntranceAttemptDoc,
  exam: EntranceExamDoc,
  candidate: EntranceCandidateDoc,
): EntranceAttemptAdminDto {
  const byIndex = new Map(attempt.answers.map((a) => [a.questionIndex, a]));
  const answers: EntranceAttemptAnswerAdminDto[] = exam.questions.map((q, index) => {
    const a = byIndex.get(index) ?? null;
    const selectedIndex = a?.selectedIndex ?? null;
    const isMcq = q.kind === 'mcq';
    const selectedOptionText =
      selectedIndex !== null ? (q.options[selectedIndex] ?? null) : null;
    const correctOptionText =
      q.correctIndex !== null ? (q.options[q.correctIndex] ?? null) : null;
    const isCorrect = isMcq
      ? selectedIndex !== null && q.correctIndex !== null
        ? selectedIndex === q.correctIndex
        : false
      : null;
    let awardedMarks: number | null;
    if (isMcq) {
      awardedMarks = isCorrect ? q.points : 0;
    } else {
      // Single-text-question model: the manual mark lives at attempt level.
      awardedMarks = attempt.manualScoreMarks ?? null;
    }
    return {
      questionIndex: index,
      section: q.section,
      questionText: q.text,
      kind: q.kind,
      options: q.options,
      selectedIndex,
      selectedOptionText,
      correctIndex: q.correctIndex,
      correctOptionText,
      isCorrect,
      textAnswer: a?.textAnswer ?? '',
      awardedMarks,
      points: q.points,
      answeredAt: a?.answeredAt ? new Date(a.answeredAt).toISOString() : null,
    };
  });

  return {
    id: String(attempt._id),
    candidate: toCandidatePublicDto(candidate),
    examId: String(attempt.examId),
    status: attempt.status,
    startedAt: new Date(attempt.startedAt).toISOString(),
    submittedAt: iso(attempt.submittedAt),
    autoSubmitted: attempt.autoSubmitted,
    autoScoreMarks: attempt.autoScoreMarks,
    manualScoreMarks: attempt.manualScoreMarks,
    manualComment: attempt.manualComment,
    totalScoreMarks: attempt.totalScoreMarks,
    totalMarks: exam.totalMarks,
    ip: attempt.ip,
    userAgent: attempt.userAgent,
    gradedByUserId: attempt.gradedByUserId ? String(attempt.gradedByUserId) : null,
    gradedAt: iso(attempt.gradedAt),
    answers,
  };
}
