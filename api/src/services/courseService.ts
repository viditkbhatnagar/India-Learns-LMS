import { Types } from 'mongoose';
import type {
  CourseDto,
  CreateCourseInput,
  Role,
  UpdateCourseInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Course,
  ModuleModel,
  Program,
  User,
  type HydratedCourse,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  return new Types.ObjectId(id);
}

function toDto(doc: HydratedCourse): CourseDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  const ids = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.map((x) => {
      if (x instanceof Types.ObjectId) return x.toString();
      return String(x);
    });
  };
  return {
    id: String(json.id),
    programId: json.programId instanceof Types.ObjectId
      ? json.programId.toString()
      : String(json.programId),
    name: json.name as string,
    slug: json.slug as string,
    summary: (json.summary as string) ?? '',
    state: json.state as CourseDto['state'],
    publishedAt: iso(json.publishedAt),
    publishedVersion: Number(json.publishedVersion ?? 0),
    sequential: Boolean(json.sequential),
    certificateTemplateId: (json.certificateTemplateId as string | null) ?? null,
    facultyIds: ids(json.facultyIds),
    programLearningOutcomes: Array.isArray(json.programLearningOutcomes)
      ? (json.programLearningOutcomes as Array<Record<string, unknown>>).map((p) => ({
        outcomeId: (p.outcomeId as string) ?? '',
        code: (p.code as string) ?? '',
        outcomeNumber: typeof p.outcomeNumber === 'number' ? p.outcomeNumber : null,
        statement: (p.statement as string) ?? '',
        bloomLevel: (p.bloomLevel as string) ?? '',
        linkedKSCs: Array.isArray(p.linkedKSCs) ? (p.linkedKSCs as string[]) : [],
      }))
      : [],
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: iso(json.deletedAt),
  };
}

export { toDto as toCourseDto };

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', `Only admins may ${verb} courses.`);
  }
}

async function assertFacultyIdsResolve(ids: string[] | undefined): Promise<Types.ObjectId[]> {
  if (!ids || ids.length === 0) return [];
  const objectIds = ids.map((id) => {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(422, 'VALIDATION_FAILED', `Invalid faculty id: ${id}`);
    }
    return new Types.ObjectId(id);
  });
  const count = await User.countDocuments({
    _id: { $in: objectIds },
    role: 'faculty',
    deletedAt: null,
  });
  if (count !== objectIds.length) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'facultyIds must all reference existing non-deleted faculty users.',
    );
  }
  return objectIds;
}

export async function listCourses(query: {
  programId?: string;
  state?: 'sandbox' | 'published';
  facultyId?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: HydratedCourse[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.programId && Types.ObjectId.isValid(query.programId)) {
    filter.programId = new Types.ObjectId(query.programId);
  }
  if (query.state) filter.state = query.state;
  if (query.facultyId && Types.ObjectId.isValid(query.facultyId)) {
    filter.facultyIds = new Types.ObjectId(query.facultyId);
  }
  const [items, total] = await Promise.all([
    Course.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Course.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function findCourseById(id: string): Promise<HydratedCourse | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Course.findOne({ _id: id, deletedAt: null });
}

export function facultyAssignedToCourse(
  course: HydratedCourse,
  userId: Types.ObjectId,
): boolean {
  return course.facultyIds.some((id) => id.equals(userId));
}

export async function createCourse(
  input: CreateCourseInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedCourse> {
  assertAdmin(actor.role, 'create');
  const programId = requireId(input.programId);
  const program = await Program.findOne({ _id: programId, deletedAt: null });
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  const slug = input.slug.trim().toLowerCase();
  const clash = await Course.findOne({ programId, slug });
  if (clash) {
    throw new HttpError(409, 'SLUG_EXISTS', 'A course with this slug already exists in the program.');
  }
  const facultyIds = await assertFacultyIdsResolve(input.facultyIds);
  const doc = await Course.create({
    programId,
    name: input.name.trim(),
    slug,
    summary: input.summary?.trim() ?? '',
    state: 'sandbox',
    publishedAt: null,
    publishedVersion: 0,
    sequential: input.sequential ?? false,
    certificateTemplateId: input.certificateTemplateId ?? null,
    facultyIds,
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'course.created',
    targetType: 'Course',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function updateCourse(
  id: string,
  patch: UpdateCourseInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedCourse> {
  assertAdmin(actor.role, 'update');
  const doc = await Course.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  const before = doc.toObject();
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.slug !== undefined) {
    const slug = patch.slug.trim().toLowerCase();
    if (slug !== doc.slug) {
      const clash = await Course.findOne({
        programId: doc.programId,
        slug,
        _id: { $ne: doc._id },
      });
      if (clash) {
        throw new HttpError(409, 'SLUG_EXISTS', 'A course with this slug already exists.');
      }
      doc.slug = slug;
    }
  }
  if (patch.summary !== undefined) doc.summary = patch.summary;
  if (patch.sequential !== undefined) doc.sequential = patch.sequential;
  if (patch.certificateTemplateId !== undefined) {
    doc.certificateTemplateId = patch.certificateTemplateId;
  }
  if (patch.facultyIds !== undefined) {
    doc.facultyIds = await assertFacultyIdsResolve(patch.facultyIds);
  }
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'course.updated',
    targetType: 'Course',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function publishCourse(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedCourse> {
  assertAdmin(actor.role, 'publish');
  const doc = await Course.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (doc.state === 'published') {
    throw new HttpError(
      409,
      'COURSE_ALREADY_PUBLISHED',
      'Course is already published.',
    );
  }
  const before = doc.toObject();
  doc.state = 'published';
  doc.publishedAt = new Date();
  doc.publishedVersion += 1;
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'course.published',
    targetType: 'Course',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function unpublishCourse(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedCourse> {
  assertAdmin(actor.role, 'unpublish');
  const doc = await Course.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (doc.state === 'sandbox') {
    throw new HttpError(
      409,
      'COURSE_NOT_PUBLISHED',
      'Course is not currently published.',
    );
  }
  const before = doc.toObject();
  doc.state = 'sandbox';
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'course.unpublished',
    targetType: 'Course',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteCourse(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedCourse> {
  assertAdmin(actor.role, 'delete');
  const doc = await Course.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');

  // PR #15 — sandbox courses cascade-soft-delete their curriculum-import
  // children (modules / sessions / materials / assignments / quizzes /
  // exams / rubrics / announcements) so the operator can clear and
  // re-import without DevTools surgery. Published courses still require
  // an empty body — protects faculty-authored teaching state from a
  // single click.
  //
  // Student-owned data (Enrollment, AttendanceRecord, AssignmentSubmission)
  // is intentionally left untouched. Sandbox courses don't have any in
  // practice; if some operator wires a real student to a sandbox, those
  // rows are preserved as audit history.
  const isSandbox = doc.state === 'sandbox';
  const cascadeCounts = {
    modules: 0,
    sessions: 0,
    materials: 0,
    assignments: 0,
    quizzes: 0,
    exams: 0,
    rubrics: 0,
    announcements: 0,
  };

  if (!isSandbox) {
    const moduleCount = await ModuleModel.countDocuments({
      courseId: doc._id,
      deletedAt: null,
    });
    if (moduleCount > 0) {
      throw new HttpError(
        409,
        'COURSE_IN_USE',
        'Cannot delete a published course that still has modules. Unpublish + clear curriculum first.',
      );
    }
  } else {
    // Lazy imports keep the courseService boot graph small (these models
    // are only referenced here for cascade and on a sandbox-delete path).
    const {
      Announcement,
      Assignment,
      Exam,
      Material,
      Quiz,
      Rubric,
      SessionModel,
    } = await import('../models/index.js');
    const now = new Date();
    const filter = { courseId: doc._id, deletedAt: null };
    const [m, s, mat, a, q, e, r, an] = await Promise.all([
      ModuleModel.updateMany(filter, { $set: { deletedAt: now } }),
      SessionModel.updateMany(filter, { $set: { deletedAt: now } }),
      Material.updateMany(filter, { $set: { deletedAt: now } }),
      Assignment.updateMany(filter, { $set: { deletedAt: now } }),
      Quiz.updateMany(filter, { $set: { deletedAt: now } }),
      Exam.updateMany(filter, { $set: { deletedAt: now } }),
      Rubric.updateMany(filter, { $set: { deletedAt: now } }),
      Announcement.updateMany(filter, { $set: { deletedAt: now } }),
    ]);
    cascadeCounts.modules = m.modifiedCount;
    cascadeCounts.sessions = s.modifiedCount;
    cascadeCounts.materials = mat.modifiedCount;
    cascadeCounts.assignments = a.modifiedCount;
    cascadeCounts.quizzes = q.modifiedCount;
    cascadeCounts.exams = e.modifiedCount;
    cascadeCounts.rubrics = r.modifiedCount;
    cascadeCounts.announcements = an.modifiedCount;
  }

  const before = doc.toObject();
  doc.deletedAt = new Date();
  doc.state = 'sandbox';
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'course.deleted',
    targetType: 'Course',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    details: isSandbox ? { cascade: cascadeCounts } : undefined,
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
