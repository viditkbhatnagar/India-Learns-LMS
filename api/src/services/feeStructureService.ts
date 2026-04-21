import { Types } from 'mongoose';
import type {
  CreateFeeStructureInput,
  FeeStructureDto,
  FeeStructureComponentDto,
  UpdateFeeStructureInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  FeeStructure,
  Program,
  type FeeComponentDoc,
  type HydratedFeeStructure,
} from '../models/index.js';
import { recordAudit } from './auditService.js';

function validateComponents(components: FeeStructureComponentDto[]): void {
  if (!components || components.length === 0) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'FeeStructure must define at least one component.',
    );
  }
  for (const c of components) {
    if (!Number.isFinite(c.amountPaise) || c.amountPaise < 0) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Component "${c.label}" must have amountPaise ≥ 0.`,
      );
    }
    if (c.cadence === 'monthly_x') {
      if (!c.monthlyCount || c.monthlyCount < 1) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `monthly_x component "${c.label}" requires monthlyCount ≥ 1.`,
        );
      }
      if (c.weights && c.weights.length !== c.monthlyCount) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `Component "${c.label}" weights[] length must match monthlyCount.`,
        );
      }
      if (c.weights) {
        const sum = c.weights.reduce((s, w) => s + w, 0);
        if (sum <= 0) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            `Component "${c.label}" weights must sum to a positive number.`,
          );
        }
      }
    }
  }
}

function toDoc(components: FeeStructureComponentDto[]): FeeComponentDoc[] {
  return components.map((c) => ({
    kind: c.kind,
    label: c.label,
    amountPaise: c.amountPaise,
    cadence: c.cadence,
    monthlyCount: c.cadence === 'monthly_x' ? c.monthlyCount ?? null : null,
    dueRule: c.dueRule,
    weights: c.weights ?? null,
  }));
}

export function toFeeStructureDto(doc: HydratedFeeStructure): FeeStructureDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    programId: doc.programId.toString(),
    name: doc.name,
    components: doc.components.map((c) => ({
      kind: c.kind,
      label: c.label,
      amountPaise: c.amountPaise,
      cadence: c.cadence,
      monthlyCount: c.monthlyCount ?? null,
      dueRule: c.dueRule,
      weights: c.weights ?? null,
    })),
    paymentTerms: doc.paymentTerms,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export interface ActorContext {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export async function createFeeStructure(
  input: CreateFeeStructureInput,
  actor: ActorContext,
): Promise<HydratedFeeStructure> {
  validateComponents(input.components);
  if (!Types.ObjectId.isValid(input.programId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'programId is not a valid id.');
  }
  const program = await Program.findById(input.programId);
  if (!program || program.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  }
  const doc = await FeeStructure.create({
    programId: program._id,
    name: input.name,
    components: toDoc(input.components),
    paymentTerms: input.paymentTerms ?? '',
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'fees.structure.created',
    targetType: 'FeeStructure',
    targetId: doc._id,
    after: doc.toJSON(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function listFeeStructures(filter: {
  programId?: string;
}): Promise<HydratedFeeStructure[]> {
  const q: Record<string, unknown> = { deletedAt: null };
  if (filter.programId) {
    if (!Types.ObjectId.isValid(filter.programId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'programId is not a valid id.');
    }
    q.programId = new Types.ObjectId(filter.programId);
  }
  return FeeStructure.find(q).sort({ createdAt: -1 });
}

export async function findFeeStructureById(
  id: string,
): Promise<HydratedFeeStructure> {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'FeeStructure not found.');
  }
  const doc = await FeeStructure.findById(id);
  if (!doc || doc.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'FeeStructure not found.');
  }
  return doc;
}

export async function updateFeeStructure(
  id: string,
  input: UpdateFeeStructureInput,
  actor: ActorContext,
): Promise<HydratedFeeStructure> {
  const doc = await findFeeStructureById(id);
  const before = doc.toJSON();
  if (input.components) {
    validateComponents(input.components);
    doc.components = toDoc(input.components) as unknown as typeof doc.components;
  }
  if (typeof input.name === 'string') doc.name = input.name;
  if (typeof input.paymentTerms === 'string') doc.paymentTerms = input.paymentTerms;
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'fees.structure.updated',
    targetType: 'FeeStructure',
    targetId: doc._id,
    before,
    after: doc.toJSON(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
