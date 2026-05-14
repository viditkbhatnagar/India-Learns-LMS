import { Types } from 'mongoose';
import type {
  BatchDto,
  BatchStatus,
  CreateBatchInput,
  Role,
  UpdateBatchInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  Enrollment,
  Program,
  User,
  type HydratedBatch,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  }
  return new Types.ObjectId(id);
}

function toDto(doc: HydratedBatch): BatchDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  const ids = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.map((x) => (x instanceof Types.ObjectId ? x.toString() : String(x)));
  };
  return {
    id: String(json.id),
    programId: doc.programId.toString(),
    name: json.name as string,
    startDate: iso(json.startDate) ?? new Date(0).toISOString(),
    endDate: iso(json.endDate) ?? new Date(0).toISOString(),
    capacity: Number(json.capacity ?? 30),
    seatsRemaining: Number(json.seatsRemaining ?? json.capacity ?? 30),
    openForApplications: Boolean(json.openForApplications),
    status: json.status as BatchStatus,
    coordinators: ids(json.coordinators),
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: iso(json.deletedAt),
  };
}

export { toDto as toBatchDto };

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', `Only admins may ${verb} batches.`);
  }
}

async function assertCoordinatorIdsResolve(ids: string[] | undefined): Promise<Types.ObjectId[]> {
  if (!ids || ids.length === 0) return [];
  const objectIds = ids.map((id) => {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(422, 'VALIDATION_FAILED', `Invalid coordinator id: ${id}`);
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
      'coordinators must all reference existing non-deleted faculty users.',
    );
  }
  return objectIds;
}

export async function listBatches(query: {
  programId?: string;
  status?: BatchStatus;
  page?: number;
  limit?: number;
}): Promise<{ items: HydratedBatch[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.programId && Types.ObjectId.isValid(query.programId)) {
    filter.programId = new Types.ObjectId(query.programId);
  }
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Batch.find(filter).sort({ startDate: 1 }).skip((page - 1) * limit).limit(limit),
    Batch.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function findBatchById(id: string): Promise<HydratedBatch | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Batch.findOne({ _id: id, deletedAt: null });
}

export async function createBatch(
  input: CreateBatchInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedBatch> {
  assertAdmin(actor.role, 'create');
  const programId = requireId(input.programId);
  const program = await Program.findOne({ _id: programId, deletedAt: null });
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid startDate or endDate.');
  }
  if (endDate <= startDate) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'endDate must be after startDate.');
  }
  const coordinators = await assertCoordinatorIdsResolve(input.coordinators);
  const capacity = input.capacity ?? 30;
  const doc = await Batch.create({
    programId,
    name: input.name.trim(),
    startDate,
    endDate,
    capacity,
    // Default seatsRemaining = capacity on create so the admit-gate has a
    // sensible starting value even before an admin flips openForApplications.
    seatsRemaining: capacity,
    status: input.status ?? 'planned',
    coordinators,
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'batch.created',
    targetType: 'Batch',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function updateBatch(
  id: string,
  patch: UpdateBatchInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedBatch> {
  assertAdmin(actor.role, 'update');
  const doc = await Batch.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  const before = doc.toObject();
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.startDate !== undefined) {
    const d = new Date(patch.startDate);
    if (Number.isNaN(d.valueOf())) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid startDate.');
    }
    doc.startDate = d;
  }
  if (patch.endDate !== undefined) {
    const d = new Date(patch.endDate);
    if (Number.isNaN(d.valueOf())) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid endDate.');
    }
    doc.endDate = d;
  }
  if (doc.endDate <= doc.startDate) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'endDate must be after startDate.');
  }
  if (patch.capacity !== undefined) {
    if (patch.capacity < 1) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'capacity must be ≥ 1.');
    }
    const active = await Enrollment.countDocuments({
      batchId: doc._id,
      status: 'active',
    });
    if (patch.capacity < active) {
      throw new HttpError(
        409,
        'BATCH_FULL',
        `Cannot shrink capacity below current active enrolments (${active}).`,
      );
    }
    doc.capacity = patch.capacity;
  }
  if (patch.status !== undefined) doc.status = patch.status;
  if (patch.coordinators !== undefined) {
    doc.coordinators = await assertCoordinatorIdsResolve(patch.coordinators);
  }
  // Admissions M5+ — admin can directly adjust the gate + the live seat
  // count. Auto-decrement at admit (M7) will use atomic $inc instead.
  if (patch.openForApplications !== undefined) {
    doc.openForApplications = patch.openForApplications;
  }
  if (patch.seatsRemaining !== undefined) {
    if (patch.seatsRemaining < 0) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'seatsRemaining must be ≥ 0.');
    }
    if (patch.seatsRemaining > doc.capacity) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `seatsRemaining cannot exceed capacity (${doc.capacity}).`,
      );
    }
    doc.seatsRemaining = patch.seatsRemaining;
  }
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'batch.updated',
    targetType: 'Batch',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteBatch(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedBatch> {
  assertAdmin(actor.role, 'delete');
  const doc = await Batch.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  const active = await Enrollment.countDocuments({
    batchId: doc._id,
    status: 'active',
  });
  if (active > 0) {
    throw new HttpError(
      409,
      'BATCH_IN_USE',
      'Cannot delete a batch with active enrolments.',
    );
  }
  const before = doc.toObject();
  doc.deletedAt = new Date();
  doc.status = 'archived';
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'batch.deleted',
    targetType: 'Batch',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
