import { Types } from 'mongoose';
import type { AnnouncementScope } from '../models/announcement.js';
import { HttpError } from '../middleware/error.js';
import {
  Announcement,
  Batch,
  Enrollment,
  Program,
  User,
  type HydratedAnnouncement,
} from '../models/index.js';
import { enqueueNotification } from './notificationService.js';
import { recordAudit } from './auditService.js';

// M10j — Broad-scope announcements (LMS_Requirements §2). Admin can
// broadcast global / program-wide; faculty can broadcast batch-wide
// (their teaching batch) or course-wide (existing flow). Each create
// fires an `announcement.published` notification fan-out.

export interface BroadcastAnnouncementInput {
  scope: Exclude<AnnouncementScope, 'course'>;
  // Optional — required when scope is 'program' or 'batch'.
  programId?: string;
  batchId?: string;
  subject: string;
  body: string;
}

export interface AnnouncementSummaryDto {
  id: string;
  scope: AnnouncementScope;
  scopeLabel: string;
  subject: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

async function recipientsForScope(input: {
  scope: AnnouncementScope;
  programId?: Types.ObjectId | null;
  batchId?: Types.ObjectId | null;
}): Promise<Types.ObjectId[]> {
  const baseFilter: Record<string, unknown> = { status: 'active', role: 'student' };
  if (input.scope === 'global') {
    // Global = everyone active. Includes faculty + finance + admin too.
    const users = await User.find({ status: 'active' })
      .select({ _id: 1 })
      .lean();
    return users.map((u) => u._id);
  }
  if (input.scope === 'program' && input.programId) {
    const users = await User.find({ ...baseFilter, programId: input.programId })
      .select({ _id: 1 })
      .lean();
    return users.map((u) => u._id);
  }
  if (input.scope === 'batch' && input.batchId) {
    const users = await User.find({ ...baseFilter, batchId: input.batchId })
      .select({ _id: 1 })
      .lean();
    return users.map((u) => u._id);
  }
  return [];
}

export async function createBroadcastAnnouncement(
  input: BroadcastAnnouncementInput,
  actor: { userId: Types.ObjectId; role: string; ip: string; ua: string },
): Promise<HydratedAnnouncement> {
  // Authz: admin/superadmin can do global + program; faculty can only
  // batch (their teaching batch). All can do course (legacy route).
  if (input.scope === 'global' || input.scope === 'program') {
    if (!['admin', 'superadmin'].includes(actor.role)) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Only admin / superadmin can broadcast at this scope.',
      );
    }
  }
  if (input.scope === 'batch') {
    if (!['admin', 'superadmin', 'faculty'].includes(actor.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'Only staff can broadcast to a batch.');
    }
  }

  let programObjId: Types.ObjectId | null = null;
  let batchObjId: Types.ObjectId | null = null;

  if (input.scope === 'program') {
    if (!input.programId || !Types.ObjectId.isValid(input.programId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'programId required for scope=program.');
    }
    const prog = await Program.findById(input.programId);
    if (!prog) throw new HttpError(404, 'NOT_FOUND', 'Programme not found.');
    programObjId = new Types.ObjectId(input.programId);
  }
  if (input.scope === 'batch') {
    if (!input.batchId || !Types.ObjectId.isValid(input.batchId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'batchId required for scope=batch.');
    }
    const batch = await Batch.findById(input.batchId);
    if (!batch || batch.deletedAt) {
      throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
    }
    // Faculty-specific guard: must teach a course in the batch.
    if (actor.role === 'faculty') {
      const enrolments = await Enrollment.find({ batchId: batch._id })
        .select({ courseId: 1 })
        .populate<{ courseId: { facultyIds?: Types.ObjectId[] } }>(
          'courseId',
          'facultyIds',
        )
        .lean();
      const teaches = enrolments.some((e) => {
        const c = e.courseId as unknown as { facultyIds?: Types.ObjectId[] } | null;
        return c?.facultyIds?.some((f) => f.toString() === actor.userId.toString());
      });
      if (!teaches) {
        throw new HttpError(403, 'FORBIDDEN', 'You do not teach a course in this batch.');
      }
    }
    batchObjId = new Types.ObjectId(input.batchId);
  }

  const doc = await Announcement.create({
    scope: input.scope,
    courseId: null,
    programId: programObjId,
    batchId: batchObjId,
    authorUserId: actor.userId,
    subject: input.subject.trim(),
    body: input.body.trim(),
  });

  await recordAudit({
    actorUserId: actor.userId,
    action: 'announcement.created',
    targetType: 'Announcement',
    targetId: doc._id,
    after: doc.toObject(),
    details: { scope: input.scope, programId: programObjId?.toString(), batchId: batchObjId?.toString() },
    ip: actor.ip,
    ua: actor.ua,
  });

  // Fan-out notification — best-effort.
  try {
    const recipients = await recipientsForScope({
      scope: input.scope,
      programId: programObjId,
      batchId: batchObjId,
    });
    if (recipients.length > 0) {
      await enqueueNotification({
        type: 'announcement.published',
        recipients,
        title: `Announcement: ${input.subject.trim()}`,
        body: input.body.trim().slice(0, 280),
        data: { announcementId: doc._id.toString(), scope: input.scope },
      });
    }
  } catch (err) {
    console.warn('[announcement] notification fan-out failed', err);
  }

  return doc;
}

export async function listAnnouncementsForUser(
  userId: Types.ObjectId,
): Promise<AnnouncementSummaryDto[]> {
  const user = await User.findById(userId).select({ programId: 1, batchId: 1 }).lean();
  if (!user) return [];
  const orClauses: Record<string, unknown>[] = [{ scope: 'global' }];
  if (user.programId) orClauses.push({ scope: 'program', programId: user.programId });
  if (user.batchId) orClauses.push({ scope: 'batch', batchId: user.batchId });
  // Course-scope announcements still surface via the legacy course feed
  // (web/src/pages/student/StudentDashboard.tsx), not this aggregator.
  const docs = await Announcement.find({ $or: orClauses, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(50);
  const authorIds = [...new Set(docs.map((d) => String(d.authorUserId)))].map(
    (s) => new Types.ObjectId(s),
  );
  const authors = await User.find({ _id: { $in: authorIds } })
    .select({ name: 1 })
    .lean();
  const aMap = new Map(authors.map((a) => [String(a._id), a.name as string]));

  // Scope labels for the UI.
  const programIds = docs.filter((d) => d.programId).map((d) => d.programId!);
  const batchIds = docs.filter((d) => d.batchId).map((d) => d.batchId!);
  const [programs, batches] = await Promise.all([
    programIds.length > 0
      ? Program.find({ _id: { $in: programIds } }).select({ name: 1 }).lean()
      : [],
    batchIds.length > 0
      ? Batch.find({ _id: { $in: batchIds } }).select({ name: 1 }).lean()
      : [],
  ]);
  const pMap = new Map(programs.map((p) => [String(p._id), p.name as string]));
  const bMap = new Map(batches.map((b) => [String(b._id), b.name as string]));

  return docs.map((d) => {
    let scopeLabel = 'Global';
    if (d.scope === 'program' && d.programId) {
      scopeLabel = `Programme: ${pMap.get(String(d.programId)) ?? 'unknown'}`;
    } else if (d.scope === 'batch' && d.batchId) {
      scopeLabel = `Batch: ${bMap.get(String(d.batchId)) ?? 'unknown'}`;
    } else if (d.scope === 'course') {
      scopeLabel = 'Course';
    }
    return {
      id: String(d._id),
      scope: d.scope,
      scopeLabel,
      subject: d.subject,
      body: d.body,
      authorName: aMap.get(String(d.authorUserId)) ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  });
}
