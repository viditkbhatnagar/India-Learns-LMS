import { Types } from 'mongoose';
import { HttpError } from '../middleware/error.js';
import {
  Assignment,
  AssignmentSubmission,
  Course,
  Enrollment,
  User,
  type AssignmentSubmissionDoc,
  type HydratedAssignment,
  type HydratedAssignmentSubmission,
  type SubmissionStatus,
} from '../models/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { recordAudit } from './auditService.js';
import { assertFacultyOwnsCourse } from './authzService.js';
import { enqueueNotification } from './notificationService.js';
import { renderTemplate } from './notificationTemplates.js';

// Two-step grading state machine — see models/assignmentSubmission.ts.
//
// Computed states (never stored):
//  - not_started: no submission row exists for (assignment, student).
//  - in_progress: not used in B-1 (no student-side drafting yet).
//  - missing:     not_started AND now > assignment.dueAt.

export type ComputedSubmissionStatus = SubmissionStatus | 'not_started' | 'missing';

export interface SubmissionDto {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  bodyText: string;
  attachmentUrl: string | null;
  submittedAt: string;
  status: SubmissionStatus;
  lateFlag: boolean;
  score: number | null;
  feedback: string | null;
  rubricScores: Array<{ criterionIndex: number; score: number; comment: string }>;
  gradedByUserId: string | null;
  gradedAt: string | null;
  publishedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Serialize a submission for staff (faculty/admin/superadmin). Returns the
 * full grade payload, including draft scores.
 */
export function toStaffSubmissionDto(
  doc: HydratedAssignmentSubmission | AssignmentSubmissionDoc,
): SubmissionDto {
  return {
    id: String(doc._id),
    assignmentId: doc.assignmentId.toString(),
    courseId: doc.courseId.toString(),
    studentId: doc.studentId.toString(),
    bodyText: doc.bodyText,
    attachmentUrl: doc.attachmentUrl,
    submittedAt: doc.submittedAt.toISOString(),
    status: doc.status,
    lateFlag: doc.lateFlag,
    score: doc.score,
    feedback: doc.feedback,
    rubricScores: (doc.rubricScores ?? []).map((r) => ({
      criterionIndex: r.criterionIndex,
      score: r.score,
      comment: r.comment,
    })),
    gradedByUserId: doc.gradedByUserId ? doc.gradedByUserId.toString() : null,
    gradedAt: doc.gradedAt ? doc.gradedAt.toISOString() : null,
    publishedByUserId: doc.publishedByUserId ? doc.publishedByUserId.toString() : null,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Serialize a submission for the student that owns it. Drafts are stripped
 * — score / feedback / rubricScores / gradedAt / gradedByUserId are blanked
 * unless `status === 'published'`. This is the API-layer enforcement of the
 * two-step rule; the UI is not the gate.
 */
export function toStudentSubmissionDto(
  doc: HydratedAssignmentSubmission | AssignmentSubmissionDoc,
): SubmissionDto {
  const full = toStaffSubmissionDto(doc);
  if (doc.status === 'published') return full;
  // Surface the existence of the submission and its lateFlag, but never any
  // grade signal. Status maps to 'submitted' regardless of internal state so
  // the student can't infer "your work is being graded right now".
  return {
    ...full,
    status: 'submitted',
    score: null,
    feedback: null,
    rubricScores: [],
    gradedByUserId: null,
    gradedAt: null,
    publishedByUserId: null,
    publishedAt: null,
  };
}

export interface DraftGradeInput {
  score: number;
  feedback?: string;
  rubricScores?: Array<{
    criterionIndex: number;
    score: number;
    comment?: string;
  }>;
}

interface ActorCtx {
  ip?: string;
  ua?: string;
}

async function loadSubmissionForStaff(
  actor: AuthContext,
  submissionId: string,
): Promise<{ submission: HydratedAssignmentSubmission; assignment: HydratedAssignment }> {
  if (!Types.ObjectId.isValid(submissionId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
  }
  const submission = await AssignmentSubmission.findById(submissionId);
  if (!submission) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');

  const assignment = await Assignment.findOne({
    _id: submission.assignmentId,
    deletedAt: null,
  });
  if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');

  await assertFacultyOwnsCourse(actor.userId, actor.role, assignment.courseId);
  return { submission, assignment };
}

/**
 * Save a draft grade. Faculty / admin / superadmin only. Transitions:
 *   submitted | needs_grading | graded_draft | published  →  graded_draft
 * Re-publishing a previously published submission is allowed: faculty saves
 * a new draft (status drops back to graded_draft), then publishes again.
 */
export async function saveDraft(
  actor: AuthContext,
  submissionId: string,
  input: DraftGradeInput,
  ctx: ActorCtx,
): Promise<HydratedAssignmentSubmission> {
  const { submission, assignment } = await loadSubmissionForStaff(actor, submissionId);

  if (input.score < 0 || input.score > assignment.maxScore) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `score must be between 0 and ${assignment.maxScore}.`,
    );
  }

  // Validate rubricScores against the assignment's rubric (if any).
  const rubric = assignment.rubric ?? [];
  const normalizedRubricScores = (input.rubricScores ?? []).map((r) => {
    if (rubric.length > 0) {
      if (r.criterionIndex < 0 || r.criterionIndex >= rubric.length) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `criterionIndex ${r.criterionIndex} out of range (rubric has ${rubric.length}).`,
        );
      }
    }
    if (r.score < 0) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'rubric score cannot be negative.');
    }
    return {
      criterionIndex: r.criterionIndex,
      score: r.score,
      comment: r.comment?.trim() ?? '',
    };
  });

  const before = submission.toObject();
  submission.score = input.score;
  submission.feedback = input.feedback?.trim() ?? null;
  submission.rubricScores = normalizedRubricScores;
  submission.gradedByUserId = actor.userId;
  submission.gradedAt = new Date();
  submission.status = 'graded_draft';
  // We DON'T touch publishedAt / publishedByUserId — they keep the prior
  // publish history if one happened. Editing a published grade returns it
  // to graded_draft until re-published.
  await submission.save();

  await recordAudit({
    actorUserId: actor.userId,
    action: 'assignment.submission.draft_saved',
    targetType: 'AssignmentSubmission',
    targetId: submission._id,
    before,
    after: submission.toObject(),
    details: {
      assignmentId: assignment._id.toString(),
      courseId: assignment.courseId.toString(),
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return submission;
}

/**
 * Publish a draft. Transitions:
 *   graded_draft → published.
 * Idempotent: publishing an already-published submission is a no-op (no
 * audit row, no notification — but the API returns 200 with the current
 * doc).
 */
export async function publishGrade(
  actor: AuthContext,
  submissionId: string,
  ctx: ActorCtx,
): Promise<HydratedAssignmentSubmission> {
  const { submission, assignment } = await loadSubmissionForStaff(actor, submissionId);

  if (submission.status === 'published') {
    return submission;
  }
  if (submission.status !== 'graded_draft') {
    throw new HttpError(
      409,
      'INVALID_TRANSITION',
      `Cannot publish from status '${submission.status}'. Save a draft first.`,
    );
  }

  const before = submission.toObject();
  submission.status = 'published';
  submission.publishedByUserId = actor.userId;
  submission.publishedAt = new Date();
  await submission.save();

  await recordAudit({
    actorUserId: actor.userId,
    action: 'assignment.submission.published',
    targetType: 'AssignmentSubmission',
    targetId: submission._id,
    before,
    after: submission.toObject(),
    details: {
      assignmentId: assignment._id.toString(),
      courseId: assignment.courseId.toString(),
      score: submission.score,
      maxScore: assignment.maxScore,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  try {
    const rendered = renderTemplate('assignment.graded', {
      assignmentTitle: assignment.title,
      scoreText:
        submission.score !== null
          ? `You scored ${submission.score} / ${assignment.maxScore}.`
          : 'Your assignment has been graded.',
    });
    await enqueueNotification({
      type: 'assignment.graded',
      recipients: [submission.studentId],
      title: rendered.title,
      body: rendered.body,
      data: {
        assignmentId: assignment._id.toString(),
        submissionId: submission._id.toString(),
      },
    });
  } catch {
    // non-fatal
  }

  return submission;
}

export interface BulkPublishResult {
  published: string[];
  skipped: Array<{ submissionId: string; reason: string }>;
  failed: Array<{ submissionId: string; reason: string }>;
}

/**
 * Bulk publish. Per OPEN-QUESTIONS.md: short-circuit on hard errors but
 * never roll back already-published rows. Already-published submissions
 * are classified as `skipped: 'already published'` so the UI can show an
 * accurate "Published X of N" count.
 */
export async function bulkPublish(
  actor: AuthContext,
  submissionIds: string[],
  ctx: ActorCtx,
): Promise<BulkPublishResult> {
  const result: BulkPublishResult = { published: [], skipped: [], failed: [] };

  for (const sid of submissionIds) {
    try {
      if (!Types.ObjectId.isValid(sid)) {
        result.failed.push({ submissionId: sid, reason: 'invalid id' });
        continue;
      }
      const existing = await AssignmentSubmission.findById(sid).select('status');
      if (!existing) {
        result.failed.push({ submissionId: sid, reason: 'not found' });
        continue;
      }
      if (existing.status === 'published') {
        result.skipped.push({ submissionId: sid, reason: 'already published' });
        continue;
      }
      await publishGrade(actor, sid, ctx);
      result.published.push(sid);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'unknown error';
      if (err instanceof HttpError && err.code === 'INVALID_TRANSITION') {
        result.skipped.push({ submissionId: sid, reason: message });
      } else {
        result.failed.push({ submissionId: sid, reason: message });
      }
    }
  }

  return result;
}

export interface GradebookCell {
  assignmentId: string;
  studentId: string;
  submissionId: string | null;
  computedStatus: ComputedSubmissionStatus;
  score: number | null;
  isDraft: boolean;
  lateFlag: boolean;
  publishedAt: string | null;
  gradedAt: string | null;
}

export interface GradebookView {
  course: { id: string; name: string };
  students: Array<{ id: string; name: string; email: string; code: string | null }>;
  assignments: Array<{
    id: string;
    title: string;
    dueAt: string;
    maxScore: number;
    deliveryVariant: string | null;
    moduleId: string | null;
    sessionId: string | null;
  }>;
  cells: GradebookCell[];
  backlog: number;
  publishedCount: number;
  draftCount: number;
}

/**
 * Build the gradebook grid for a course. Faculty must own the course;
 * superadmin sees any course (oversight). For staff only — students are
 * served their own grades through `/v1/assignments/:id` etc.
 */
export async function getGradebookView(
  actor: AuthContext,
  courseId: string,
): Promise<GradebookView> {
  if (!Types.ObjectId.isValid(courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const course = await Course.findOne({ _id: courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  await assertFacultyOwnsCourse(actor.userId, actor.role, course._id);

  // Pull assignments (rows are not cells; one per (student, assignment)).
  const assignments = await Assignment.find({
    courseId: course._id,
    deletedAt: null,
  })
    .sort({ dueAt: 1 })
    .lean();

  // Pull active enrollments → student ids.
  const enrolments = await Enrollment.find({
    courseId: course._id,
    status: 'active',
  }).select('studentId');
  const studentIds = enrolments.map((e) => e.studentId);

  const students = await User.find({ _id: { $in: studentIds } })
    .select('_id name email code')
    .sort({ name: 1 })
    .lean();

  const submissions = await AssignmentSubmission.find({
    courseId: course._id,
  }).lean();

  const submissionByKey = new Map<string, (typeof submissions)[number]>();
  for (const s of submissions) {
    submissionByKey.set(`${s.assignmentId.toString()}::${s.studentId.toString()}`, s);
  }

  const now = Date.now();
  const cells: GradebookCell[] = [];
  let backlog = 0;
  let publishedCount = 0;
  let draftCount = 0;
  for (const a of assignments) {
    const dueMs = a.dueAt instanceof Date ? a.dueAt.getTime() : new Date(a.dueAt).getTime();
    const aId = String(a._id);
    for (const stu of students) {
      const sId = String(stu._id);
      const sub = submissionByKey.get(`${aId}::${sId}`);
      if (!sub) {
        cells.push({
          assignmentId: aId,
          studentId: sId,
          submissionId: null,
          computedStatus: now > dueMs ? 'missing' : 'not_started',
          score: null,
          isDraft: false,
          lateFlag: false,
          publishedAt: null,
          gradedAt: null,
        });
        continue;
      }
      const isDraft = sub.status === 'graded_draft';
      const isPublished = sub.status === 'published';
      if (sub.status === 'submitted' || sub.status === 'needs_grading') backlog += 1;
      if (isDraft) draftCount += 1;
      if (isPublished) publishedCount += 1;
      cells.push({
        assignmentId: aId,
        studentId: sId,
        submissionId: String(sub._id),
        computedStatus: sub.status,
        score: isPublished ? sub.score : null,
        isDraft,
        lateFlag: sub.lateFlag ?? false,
        publishedAt: sub.publishedAt
          ? (sub.publishedAt instanceof Date
            ? sub.publishedAt.toISOString()
            : new Date(sub.publishedAt).toISOString())
          : null,
        gradedAt: sub.gradedAt
          ? (sub.gradedAt instanceof Date
            ? sub.gradedAt.toISOString()
            : new Date(sub.gradedAt).toISOString())
          : null,
      });
    }
  }

  return {
    course: { id: String(course._id), name: course.name },
    students: students.map((s) => ({
      id: String(s._id),
      name: s.name as string,
      email: s.email as string,
      code: (s.code as string | null) ?? null,
    })),
    assignments: assignments.map((a) => ({
      id: String(a._id),
      title: a.title as string,
      dueAt: (a.dueAt instanceof Date ? a.dueAt : new Date(a.dueAt as string)).toISOString(),
      maxScore: a.maxScore as number,
      deliveryVariant: (a.deliveryVariant as string | null) ?? null,
      moduleId: a.moduleId ? String(a.moduleId) : null,
      sessionId: a.sessionId ? String(a.sessionId) : null,
    })),
    cells,
    backlog,
    publishedCount,
    draftCount,
  };
}
