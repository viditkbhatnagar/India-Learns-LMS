import { Types } from 'mongoose';
import type {
  CreateFeedbackInput,
  FeedbackEntryDto,
  FeedbackListQuery,
  UpdateFeedbackInput,
} from 'india-learns-shared-types';
import type { AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  FeedbackEntry,
  Rubric,
  type FeedbackScoreDoc,
  type HydratedFeedbackEntry,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { assertFacultyOwnsCourse } from './authzService.js';
import { nowUtc } from './clockService.js';
import { enqueueNotification } from './notificationService.js';

export interface FeedbackCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export function toFeedbackEntryDto(doc: HydratedFeedbackEntry): FeedbackEntryDto {
  return {
    id: doc._id.toString(),
    studentId: doc.studentId.toString(),
    courseId: doc.courseId.toString(),
    moduleId: doc.moduleId ? doc.moduleId.toString() : null,
    facultyId: doc.facultyId.toString(),
    level: doc.level,
    assessmentRef: doc.assessmentRef ? doc.assessmentRef.toString() : null,
    rubricId: doc.rubricId ? doc.rubricId.toString() : null,
    scores: doc.scores.map((s) => ({
      criterionIndex: s.criterionIndex,
      score: s.score,
      label: s.label,
    })),
    comments: doc.comments,
    summary: doc.summary,
    status: doc.status,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function validateScoresAgainstRubric(
  rubricId: Types.ObjectId | null,
  scores: FeedbackScoreDoc[] | undefined,
): Promise<FeedbackScoreDoc[]> {
  if (!rubricId) return scores ?? [];
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Rubric not found.');
  }
  const expected = rubric.criteria.length;
  const provided = scores ?? [];
  if (provided.length !== expected) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `scores length (${provided.length}) must equal rubric criteria length (${expected}).`,
    );
  }
  return provided.map((s, idx) => ({
    criterionIndex: s.criterionIndex ?? idx,
    score: s.score ?? null,
    label: s.label ?? null,
  }));
}

function assertLevelShape(
  level: string,
  moduleId: Types.ObjectId | null,
  assessmentRef: Types.ObjectId | null,
): void {
  if (level === 'assignment' && !moduleId) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Assignment-level feedback requires moduleId.',
    );
  }
  if (level === 'module' && !moduleId) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Module-level feedback requires moduleId.',
    );
  }
  if (level === 'assessment' && !assessmentRef) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Assessment-level feedback requires assessmentRef.',
    );
  }
}

export async function createFeedback(
  actor: AuthContext,
  input: CreateFeedbackInput,
  ctx: FeedbackCtx,
): Promise<HydratedFeedbackEntry> {
  if (!Types.ObjectId.isValid(input.courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, input.courseId);
  if (!Types.ObjectId.isValid(input.studentId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'studentId invalid.');
  }

  const moduleId = input.moduleId && Types.ObjectId.isValid(input.moduleId)
    ? new Types.ObjectId(input.moduleId)
    : null;
  const assessmentRef = input.assessmentRef && Types.ObjectId.isValid(input.assessmentRef)
    ? new Types.ObjectId(input.assessmentRef)
    : null;
  const rubricId = input.rubricId && Types.ObjectId.isValid(input.rubricId)
    ? new Types.ObjectId(input.rubricId)
    : null;

  assertLevelShape(input.level, moduleId, assessmentRef);
  const scores = await validateScoresAgainstRubric(rubricId, input.scores);

  if (!input.summary || !input.summary.trim()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'summary is required.');
  }

  const entry = await FeedbackEntry.create({
    studentId: new Types.ObjectId(input.studentId),
    courseId: new Types.ObjectId(input.courseId),
    moduleId,
    facultyId: actor.userId,
    level: input.level,
    assessmentRef,
    rubricId,
    scores,
    comments: input.comments ?? '',
    summary: input.summary.trim(),
    status: input.status ?? 'draft',
    publishedAt: null,
  });

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'feedback.created',
    targetType: 'FeedbackEntry',
    targetId: entry._id,
    after: entry.toJSON(),
    details: { level: entry.level, status: entry.status },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  if (entry.status === 'published') {
    await publishFeedback(actor, entry._id.toString(), ctx);
    return (await FeedbackEntry.findById(entry._id))!;
  }
  return entry;
}

export async function updateFeedback(
  actor: AuthContext,
  feedbackId: string,
  input: UpdateFeedbackInput,
  ctx: FeedbackCtx,
): Promise<HydratedFeedbackEntry> {
  if (!Types.ObjectId.isValid(feedbackId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  const entry = await FeedbackEntry.findById(feedbackId);
  if (!entry) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, entry.courseId);
  if (!entry.facultyId.equals(actor.userId) && actor.role === 'faculty') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own feedback.');
  }
  if (entry.status === 'published' && input.status !== 'published') {
    throw new HttpError(
      409,
      'FEEDBACK_ALREADY_PUBLISHED',
      'Published feedback cannot be reverted to draft.',
    );
  }

  const before = entry.toJSON();

  if (input.moduleId !== undefined) {
    entry.moduleId = input.moduleId && Types.ObjectId.isValid(input.moduleId)
      ? new Types.ObjectId(input.moduleId)
      : null;
  }
  if (input.level !== undefined) entry.level = input.level;
  if (input.assessmentRef !== undefined) {
    entry.assessmentRef = input.assessmentRef && Types.ObjectId.isValid(input.assessmentRef)
      ? new Types.ObjectId(input.assessmentRef)
      : null;
  }
  if (input.rubricId !== undefined) {
    entry.rubricId = input.rubricId && Types.ObjectId.isValid(input.rubricId)
      ? new Types.ObjectId(input.rubricId)
      : null;
  }
  if (input.comments !== undefined) entry.comments = input.comments;
  if (input.summary !== undefined) {
    if (!input.summary.trim()) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'summary cannot be empty.');
    }
    entry.summary = input.summary.trim();
  }
  assertLevelShape(entry.level, entry.moduleId, entry.assessmentRef);
  if (input.scores !== undefined || input.rubricId !== undefined) {
    const scores = await validateScoresAgainstRubric(
      entry.rubricId,
      input.scores ?? entry.scores,
    );
    entry.scores = scores as FeedbackScoreDoc[];
  }

  const willPublish = input.status === 'published' && entry.status !== 'published';

  await entry.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'feedback.updated',
    targetType: 'FeedbackEntry',
    targetId: entry._id,
    before,
    after: entry.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });

  if (willPublish) {
    return publishFeedback(actor, entry._id.toString(), ctx);
  }
  return entry;
}

export async function publishFeedback(
  actor: AuthContext,
  feedbackId: string,
  ctx: FeedbackCtx,
): Promise<HydratedFeedbackEntry> {
  if (!Types.ObjectId.isValid(feedbackId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  const entry = await FeedbackEntry.findById(feedbackId);
  if (!entry) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, entry.courseId);
  if (!entry.facultyId.equals(actor.userId) && actor.role === 'faculty') {
    throw new HttpError(403, 'FORBIDDEN', 'You can only publish your own feedback.');
  }
  if (entry.status === 'published') return entry;

  const before = entry.toJSON();
  entry.status = 'published';
  entry.publishedAt = nowUtc();
  await entry.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'feedback.published',
    targetType: 'FeedbackEntry',
    targetId: entry._id,
    before,
    after: entry.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });

  try {
    await enqueueNotification({
      type: 'feedback.published',
      recipients: [entry.studentId],
      title: `New feedback from your faculty`,
      body: entry.summary.slice(0, 500),
      data: {
        feedbackId: entry._id.toString(),
        courseId: entry.courseId.toString(),
        level: entry.level,
      },
    });
  } catch {
    // Non-fatal.
  }

  return entry;
}

export async function listFeedback(
  actor: AuthContext,
  query: FeedbackListQuery,
): Promise<HydratedFeedbackEntry[]> {
  const filter: Record<string, unknown> = {};
  if (query.studentId) {
    if (!Types.ObjectId.isValid(query.studentId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'studentId invalid.');
    }
    filter.studentId = new Types.ObjectId(query.studentId);
  }
  if (query.courseId) {
    if (!Types.ObjectId.isValid(query.courseId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'courseId invalid.');
    }
    filter.courseId = new Types.ObjectId(query.courseId);
  }
  if (query.moduleId) {
    if (!Types.ObjectId.isValid(query.moduleId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'moduleId invalid.');
    }
    filter.moduleId = new Types.ObjectId(query.moduleId);
  }
  if (query.facultyId) {
    if (!Types.ObjectId.isValid(query.facultyId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'facultyId invalid.');
    }
    filter.facultyId = new Types.ObjectId(query.facultyId);
  }
  if (query.level) filter.level = query.level;
  if (query.status) filter.status = query.status;

  if (actor.role === 'faculty') {
    // Faculty may only see their own drafts + any published for their courses.
    filter.facultyId = actor.userId;
  } else if (actor.role === 'student') {
    throw new HttpError(403, 'FORBIDDEN', 'Use /me/feedback instead.');
  }

  const limit = Math.min(500, Math.max(1, query.limit ?? 100));
  return FeedbackEntry.find(filter).sort({ createdAt: -1 }).limit(limit);
}

export async function getFeedback(
  actor: AuthContext,
  feedbackId: string,
): Promise<HydratedFeedbackEntry> {
  if (!Types.ObjectId.isValid(feedbackId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  const entry = await FeedbackEntry.findById(feedbackId);
  if (!entry) {
    throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
  }
  if (actor.role === 'student') {
    if (!entry.studentId.equals(actor.userId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Not your feedback.');
    }
    if (entry.status !== 'published') {
      throw new HttpError(404, 'NOT_FOUND', 'Feedback not found.');
    }
  } else if (actor.role === 'faculty') {
    await assertFacultyOwnsCourse(actor.userId, actor.role, entry.courseId);
  } else if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    // Default-deny: any future role (e.g. finance) must be explicitly allow-listed
    // before it can read faculty-authored feedback. Avoids repeating the
    // `GET /v1/feedback/:id` missing-requireRole regression (security review
    // finding, 2026-04-22).
    throw new HttpError(403, 'FORBIDDEN', 'Not permitted to read this feedback.');
  }
  return entry;
}

export async function listForStudent(
  studentId: Types.ObjectId,
  limit = 100,
): Promise<HydratedFeedbackEntry[]> {
  return FeedbackEntry.find({
    studentId,
    status: 'published',
  })
    .sort({ publishedAt: -1 })
    .limit(Math.min(500, Math.max(1, limit)));
}
