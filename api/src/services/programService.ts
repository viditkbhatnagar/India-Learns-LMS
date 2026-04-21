import { Types } from 'mongoose';
import type {
  CreateProgramInput,
  ProgramDto,
  Role,
  UpdateProgramInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Course,
  Program,
  type HydratedProgram,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  }
  return new Types.ObjectId(id);
}

function toDto(doc: HydratedProgram): ProgramDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id: String(json.id),
    name: json.name as string,
    slug: json.slug as string,
    description: (json.description as string) ?? '',
    totalHours: Number(json.totalHours ?? 300),
    isActive: Boolean(json.isActive),
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: iso(json.deletedAt),
  };
}

export { toDto as toProgramDto };

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', `Only admins may ${verb} programs.`);
  }
}

export async function listPrograms(query: {
  q?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ items: HydratedProgram[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (typeof query.isActive === 'boolean') filter.isActive = query.isActive;
  if (query.q) {
    const safe = query.q.trim().replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { slug: { $regex: safe, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    Program.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Program.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function findProgramById(id: string): Promise<HydratedProgram | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Program.findOne({ _id: id, deletedAt: null });
}

export async function createProgram(
  input: CreateProgramInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedProgram> {
  assertAdmin(actor.role, 'create');
  const slug = input.slug.trim().toLowerCase();
  const existing = await Program.findOne({ slug });
  if (existing) {
    throw new HttpError(409, 'SLUG_EXISTS', 'A program with this slug already exists.');
  }
  const doc = await Program.create({
    name: input.name.trim(),
    slug,
    description: input.description?.trim() ?? '',
    totalHours: input.totalHours ?? 300,
    isActive: input.isActive ?? true,
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'program.created',
    targetType: 'Program',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function updateProgram(
  id: string,
  patch: UpdateProgramInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedProgram> {
  assertAdmin(actor.role, 'update');
  const doc = await Program.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  const before = doc.toObject();
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.slug !== undefined) {
    const slug = patch.slug.trim().toLowerCase();
    if (slug !== doc.slug) {
      const clash = await Program.findOne({ slug, _id: { $ne: doc._id } });
      if (clash) {
        throw new HttpError(409, 'SLUG_EXISTS', 'A program with this slug already exists.');
      }
      doc.slug = slug;
    }
  }
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.totalHours !== undefined) doc.totalHours = patch.totalHours;
  if (patch.isActive !== undefined) doc.isActive = patch.isActive;
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'program.updated',
    targetType: 'Program',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteProgram(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedProgram> {
  assertAdmin(actor.role, 'delete');
  const doc = await Program.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  const courseCount = await Course.countDocuments({
    programId: doc._id,
    deletedAt: null,
  });
  if (courseCount > 0) {
    throw new HttpError(
      409,
      'PROGRAM_IN_USE',
      'Cannot delete a program that still has courses.',
    );
  }
  const before = doc.toObject();
  doc.deletedAt = new Date();
  doc.isActive = false;
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'program.deleted',
    targetType: 'Program',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
