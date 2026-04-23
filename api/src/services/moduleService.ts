import { Types } from 'mongoose';
import type {
  CreateModuleInput,
  ModuleContentDto,
  ModuleContentInput,
  ModuleDto,
  Role,
  UpdateModuleInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Course,
  ModuleModel,
  type HydratedModule,
  type ModuleContentBlockDoc,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { facultyAssignedToCourse } from './courseService.js';
import type { ActorContext } from './userService.js';

const ADMIN_PATCH_FIELDS = new Set<keyof UpdateModuleInput>(['title', 'order', 'content']);
const FACULTY_PATCH_FIELDS = new Set<keyof UpdateModuleInput>(['content']);

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  }
  return new Types.ObjectId(id);
}

function normalizeContent(input: ModuleContentInput[] | undefined): Array<Omit<ModuleContentBlockDoc, '_id'>> {
  if (!input) return [];
  return input.map((block) => {
    if (!['video', 'pdf', 'text', 'quizRef'].includes(block.kind)) {
      throw new HttpError(422, 'VALIDATION_FAILED', `Unknown content kind: ${block.kind}`);
    }
    const base = {
      kind: block.kind,
      title: block.title.trim(),
      videoUrl: null as string | null,
      pdfUrl: null as string | null,
      pdfStorageKey: null as string | null,
      allowDownload: false,
      textMarkdown: null as string | null,
      quizId: null as Types.ObjectId | null,
    };
    switch (block.kind) {
      case 'video':
        if (!block.videoUrl) {
          throw new HttpError(422, 'VALIDATION_FAILED', 'Video content must carry a videoUrl.');
        }
        base.videoUrl = block.videoUrl;
        break;
      case 'pdf':
        if (!block.pdfUrl && !block.pdfStorageKey) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'PDF content must carry a pdfUrl or pdfStorageKey.',
          );
        }
        base.pdfUrl = block.pdfUrl ?? null;
        base.pdfStorageKey = block.pdfStorageKey ?? null;
        base.allowDownload = Boolean(block.allowDownload);
        break;
      case 'text':
        if (!block.textMarkdown) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'Text content must carry textMarkdown.',
          );
        }
        base.textMarkdown = block.textMarkdown;
        break;
      case 'quizRef':
        if (!block.quizId || !Types.ObjectId.isValid(block.quizId)) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'quizRef content must carry a valid quizId.',
          );
        }
        base.quizId = new Types.ObjectId(block.quizId);
        break;
      default:
        break;
    }
    return base;
  });
}

function toContentDto(block: ModuleContentBlockDoc): ModuleContentDto {
  return {
    id: String(block._id),
    kind: block.kind,
    title: block.title,
    videoUrl: block.videoUrl,
    pdfUrl: block.pdfUrl,
    pdfStorageKey: block.pdfStorageKey,
    allowDownload: Boolean(block.allowDownload),
    textMarkdown: block.textMarkdown,
    quizId: block.quizId ? block.quizId.toString() : null,
  };
}

function toDto(doc: HydratedModule): ModuleDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  const content = Array.isArray(doc.content)
    ? (doc.content as unknown as ModuleContentBlockDoc[]).map(toContentDto)
    : [];
  return {
    id: String(json.id),
    courseId: doc.courseId.toString(),
    title: json.title as string,
    order: Number(json.order ?? 0),
    content,
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: iso(json.deletedAt),
  };
}

export { toDto as toModuleDto, toContentDto as toModuleContentDto };

export async function findModuleById(id: string): Promise<HydratedModule | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return ModuleModel.findOne({ _id: id, deletedAt: null });
}

export async function listModulesForCourse(courseId: string): Promise<HydratedModule[]> {
  if (!Types.ObjectId.isValid(courseId)) return [];
  return ModuleModel.find({ courseId, deletedAt: null }).sort({ order: 1 });
}

export async function createModule(
  courseId: string,
  input: CreateModuleInput,
  actor: { role: Role; userId?: Types.ObjectId } & ActorContext,
): Promise<HydratedModule> {
  if (actor.role !== 'admin' && actor.role !== 'faculty') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins or assigned faculty may create modules.');
  }
  const course = await Course.findOne({ _id: requireId(courseId), deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (actor.role === 'faculty') {
    if (!actor.userId || !facultyAssignedToCourse(course, actor.userId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
    }
  }
  const clash = await ModuleModel.findOne({
    courseId: course._id,
    order: input.order,
    deletedAt: null,
  });
  if (clash) {
    throw new HttpError(409, 'CONFLICT', 'Another module already uses that order in this course.');
  }
  const doc = await ModuleModel.create({
    courseId: course._id,
    title: input.title.trim(),
    order: input.order,
    content: normalizeContent(input.content),
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'module.created',
    targetType: 'Module',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function updateModule(
  id: string,
  patch: UpdateModuleInput,
  actor: { role: Role; userId: Types.ObjectId } & ActorContext,
): Promise<HydratedModule> {
  const doc = await ModuleModel.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  const course = await Course.findOne({ _id: doc.courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Parent course not found.');

  const allowed =
    actor.role === 'admin'
      ? ADMIN_PATCH_FIELDS
      : actor.role === 'faculty' && facultyAssignedToCourse(course, actor.userId)
        ? FACULTY_PATCH_FIELDS
        : null;
  if (!allowed) {
    throw new HttpError(403, 'FORBIDDEN', 'Not permitted to edit this module.');
  }
  for (const key of Object.keys(patch) as (keyof UpdateModuleInput)[]) {
    if (!allowed.has(key)) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        `Field ${key} cannot be edited by role ${actor.role}.`,
      );
    }
  }

  const before = doc.toObject();
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.order !== undefined) {
    if (patch.order !== doc.order) {
      const clash = await ModuleModel.findOne({
        courseId: doc.courseId,
        order: patch.order,
        deletedAt: null,
        _id: { $ne: doc._id },
      });
      if (clash) {
        throw new HttpError(409, 'CONFLICT', 'Another module already uses that order.');
      }
      doc.order = patch.order;
    }
  }
  if (patch.content !== undefined) {
    doc.set('content', normalizeContent(patch.content));
  }
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'module.updated',
    targetType: 'Module',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteModule(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedModule> {
  if (actor.role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may delete modules.');
  }
  const doc = await ModuleModel.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  const before = doc.toObject();
  doc.deletedAt = new Date();
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'module.deleted',
    targetType: 'Module',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
