import { Types } from 'mongoose';
import type {
  ExamAttemptGradeInput,
  GradeExamAttemptInput,
} from 'india-learns-shared-types';
import type { AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  Exam,
  ExamAttempt,
  Rubric,
  type ExamAttemptGradeDoc,
  type HydratedExamAttempt,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { assertFacultyOwnsCourse } from './authzService.js';
import { nowUtc } from './clockService.js';
import {
  computeEssayTotals,
  computeTotalPercent,
  gradeMcqAnswers,
} from './assessmentScoring.js';
import { checkAllActiveEnrolmentsForStudentCourse } from './courseCompletionService.js';
import { enqueueNotification } from './notificationService.js';
import { renderTemplate } from './notificationTemplates.js';

export interface GradingCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

function normalizeGradeInput(
  grade: ExamAttemptGradeInput,
  essayQuestionPoints: number,
): ExamAttemptGradeDoc {
  if (grade.score < 0 || grade.score > essayQuestionPoints) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Grade ${grade.score} out of range 0..${essayQuestionPoints}.`,
    );
  }
  return {
    questionIndex: grade.questionIndex,
    score: grade.score,
    comment: grade.comment ?? '',
    rubricScores: (grade.rubricScores ?? []).map((r) => ({
      criterionIndex: r.criterionIndex,
      score: r.score ?? null,
      label: r.label ?? null,
    })),
  };
}

export async function gradeExamAttempt(
  actor: AuthContext,
  attemptId: string,
  input: GradeExamAttemptInput,
  ctx: GradingCtx,
): Promise<HydratedExamAttempt> {
  if (!Types.ObjectId.isValid(attemptId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam attempt not found.');
  }
  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam attempt not found.');
  }
  if (!attempt.submittedAt) {
    throw new HttpError(
      409,
      'ASSESSMENT_NOT_SUBMITTED',
      'Cannot grade an attempt that has not been submitted.',
    );
  }
  const exam = await Exam.findById(attempt.examId);
  if (!exam) {
    throw new HttpError(404, 'NOT_FOUND', 'Exam not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, exam.courseId);

  // Validate every grade points at an actual essay question.
  const essayIndices = new Set<number>();
  exam.questions.forEach((q, idx) => {
    if (q.kind === 'essay') essayIndices.add(idx);
  });

  const normalizedGrades = (input.grades ?? []).map((g) => {
    if (!essayIndices.has(g.questionIndex)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Question ${g.questionIndex} is not an essay question.`,
      );
    }
    const question = exam.questions[g.questionIndex]!;

    // If the question references a rubric, enforce that rubricScores align
    // with that rubric's criteria length (all-or-nothing).
    if (question.rubricId && g.rubricScores && g.rubricScores.length > 0) {
      // Lazy validation: we'll fetch the rubric below to check.
    }
    return normalizeGradeInput(g, question.points);
  });

  // Rubric coherence check — only issue one query per unique rubric id.
  const rubricIds = new Set<string>();
  exam.questions.forEach((q) => {
    if (q.kind === 'essay' && q.rubricId) rubricIds.add(q.rubricId.toString());
  });
  const rubricCriteriaCount = new Map<string, number>();
  if (rubricIds.size > 0) {
    const rubrics = await Rubric.find({
      _id: { $in: Array.from(rubricIds).map((id) => new Types.ObjectId(id)) },
    }).select('_id criteria');
    rubrics.forEach((r) => rubricCriteriaCount.set(r._id.toString(), r.criteria.length));
  }
  normalizedGrades.forEach((g) => {
    const q = exam.questions[g.questionIndex]!;
    if (q.rubricId && g.rubricScores.length > 0) {
      const expected = rubricCriteriaCount.get(q.rubricId.toString());
      if (expected !== undefined && g.rubricScores.length !== expected) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `rubricScores length (${g.rubricScores.length}) must equal criteria length (${expected}).`,
        );
      }
    }
  });

  // Replace (not merge) grades for idempotency: re-grading rewrites the array.
  const before = attempt.toJSON();
  attempt.grades = normalizedGrades;
  attempt.graderUserId = actor.userId;
  attempt.gradedAt = nowUtc();

  // Recompute MCQ portion fresh (cheap) in case questions changed since submit.
  const mcqResult = gradeMcqAnswers(exam.questions, attempt.answers);
  attempt.mcqScorePercent = Math.round(mcqResult.mcqScorePercent * 100) / 100;

  const { essayEarned, essayTotal, allEssaysGraded } = computeEssayTotals(
    exam.questions,
    normalizedGrades,
  );
  attempt.essayScorePercent = essayTotal === 0
    ? 100
    : Math.round(((essayEarned / essayTotal) * 100) * 100) / 100;

  if (allEssaysGraded) {
    const totalPercent = computeTotalPercent(
      mcqResult.earned,
      mcqResult.total,
      essayEarned,
      essayTotal,
    );
    attempt.totalScorePercent = Math.round(totalPercent * 100) / 100;
    attempt.passed = attempt.totalScorePercent >= exam.passingPercent;
  } else {
    attempt.totalScorePercent = null;
    attempt.passed = null;
  }

  await attempt.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'exam.attempt.graded',
    targetType: 'ExamAttempt',
    targetId: attempt._id,
    before,
    after: attempt.toJSON(),
    details: {
      examId: exam._id.toString(),
      totalScorePercent: attempt.totalScorePercent,
      passed: attempt.passed,
      allEssaysGraded,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  if (allEssaysGraded && attempt.totalScorePercent !== null) {
    try {
      const rendered = renderTemplate('assessment.graded.exam', {
        examTitle: exam.title,
        scorePercent: attempt.totalScorePercent,
        passed: attempt.passed ?? false,
      });
      await enqueueNotification({
        type: 'assessment.graded',
        recipients: [attempt.studentId],
        title: rendered.title,
        body: rendered.body,
        data: {
          examId: exam._id.toString(),
          attemptId: attempt._id.toString(),
          scorePercent: attempt.totalScorePercent,
          passed: attempt.passed,
        },
      });
    } catch {
      // Non-fatal — grade is already persisted.
    }

    if (attempt.passed) {
      try {
        await checkAllActiveEnrolmentsForStudentCourse(
          attempt.studentId,
          exam.courseId,
          ctx.actorUserId,
        );
      } catch {
        // Non-fatal.
      }
    }
  }

  return attempt;
}

export interface ListQueueQuery {
  courseId?: string;
  limit?: number;
}

export async function listGradingQueueForFaculty(
  actor: AuthContext,
  query: ListQueueQuery,
): Promise<HydratedExamAttempt[]> {
  if (!['faculty', 'admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Role not permitted.');
  }

  // Scope: attempts that are submitted but have un-graded essay portion. For
  // faculty, restrict to exams on courses they own.
  let examIds: Types.ObjectId[] | null = null;
  if (actor.role === 'faculty') {
    const exams = await Exam.find({ state: { $in: ['live', 'closed'] } })
      .select('_id courseId');
    // Course-level filter: keep only exams whose course's facultyIds includes us.
    const courseIds = Array.from(new Set(exams.map((e) => e.courseId.toString())));
    const ownedCourseIds: string[] = [];
    for (const cid of courseIds) {
      try {
        await assertFacultyOwnsCourse(actor.userId, 'faculty', cid);
        ownedCourseIds.push(cid);
      } catch {
        // not owned — skip silently
      }
    }
    examIds = exams
      .filter((e) => ownedCourseIds.includes(e.courseId.toString()))
      .map((e) => e._id);
  }

  const filter: Record<string, unknown> = {
    submittedAt: { $ne: null },
    totalScorePercent: null,
  };
  if (query.courseId) {
    if (!Types.ObjectId.isValid(query.courseId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'courseId invalid.');
    }
    const examsInCourse = await Exam.find({ courseId: query.courseId }).select('_id');
    const courseExamIds = examsInCourse.map((e) => e._id);
    filter.examId = examIds
      ? { $in: examIds.filter((id) => courseExamIds.some((cid) => cid.equals(id))) }
      : { $in: courseExamIds };
  } else if (examIds) {
    filter.examId = { $in: examIds };
  }

  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  return ExamAttempt.find(filter).sort({ submittedAt: 1 }).limit(limit);
}
