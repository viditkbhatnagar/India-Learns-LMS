import { Types } from 'mongoose';
import type {
  CreateRubricInput,
  RubricCriterionDto,
  RubricDto,
  UpdateRubricInput,
} from 'india-learns-shared-types';
import type { AuthContext } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  Rubric,
  type HydratedRubric,
  type RubricCriterionDoc,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { assertFacultyOwnsCourse } from './authzService.js';

export interface RubricCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export function toRubricDto(doc: HydratedRubric): RubricDto {
  return {
    id: doc._id.toString(),
    courseId: doc.courseId.toString(),
    name: doc.name,
    criteria: doc.criteria.map((c) => ({
      label: c.label,
      kind: c.kind,
      maxScore: c.maxScore,
      scale: [...c.scale],
    })),
    isTemplate: doc.isTemplate,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizeCriteria(
  criteria: RubricCriterionDto[],
): RubricCriterionDoc[] {
  if (!criteria || criteria.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Rubric must have at least one criterion.');
  }
  return criteria.map((c) => {
    if (c.kind === 'numeric') {
      if (!c.maxScore || c.maxScore < 1) {
        throw new HttpError(
          422,
          'VALIDATION_FAILED',
          `Numeric criterion "${c.label}" requires maxScore >= 1.`,
        );
      }
      return {
        label: c.label,
        kind: 'numeric' as const,
        maxScore: c.maxScore,
        scale: [],
      };
    }
    if (!c.scale || c.scale.length < 2) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Scale criterion "${c.label}" requires at least 2 scale labels.`,
      );
    }
    return {
      label: c.label,
      kind: 'scale' as const,
      maxScore: null,
      scale: [...c.scale],
    };
  });
}

export async function createRubric(
  actor: AuthContext,
  input: CreateRubricInput,
  ctx: RubricCtx,
): Promise<HydratedRubric> {
  if (!Types.ObjectId.isValid(input.courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, input.courseId);
  const rubric = await Rubric.create({
    courseId: new Types.ObjectId(input.courseId),
    name: input.name,
    criteria: normalizeCriteria(input.criteria),
    isTemplate: input.isTemplate ?? false,
  });
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'rubric.created',
    targetType: 'Rubric',
    targetId: rubric._id,
    after: rubric.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return rubric;
}

export async function updateRubric(
  actor: AuthContext,
  rubricId: string,
  input: UpdateRubricInput,
  ctx: RubricCtx,
): Promise<HydratedRubric> {
  if (!Types.ObjectId.isValid(rubricId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, rubric.courseId);
  const before = rubric.toJSON();
  if (input.name !== undefined) rubric.name = input.name;
  if (input.criteria !== undefined) {
    rubric.criteria = normalizeCriteria(input.criteria) as RubricCriterionDoc[];
  }
  if (input.isTemplate !== undefined) rubric.isTemplate = input.isTemplate;
  await rubric.save();
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'rubric.updated',
    targetType: 'Rubric',
    targetId: rubric._id,
    before,
    after: rubric.toJSON(),
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return rubric;
}

export async function deleteRubric(
  actor: AuthContext,
  rubricId: string,
  ctx: RubricCtx,
): Promise<void> {
  if (!Types.ObjectId.isValid(rubricId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  await assertFacultyOwnsCourse(actor.userId, actor.role, rubric.courseId);
  const before = rubric.toJSON();
  await rubric.deleteOne();
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'rubric.deleted',
    targetType: 'Rubric',
    targetId: rubric._id,
    before,
    ip: ctx.ip,
    ua: ctx.ua,
  });
}

export async function listRubrics(
  actor: AuthContext,
  courseId?: string,
): Promise<HydratedRubric[]> {
  const filter: Record<string, unknown> = {};
  if (courseId) {
    if (!Types.ObjectId.isValid(courseId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'courseId invalid.');
    }
    filter.courseId = new Types.ObjectId(courseId);
    if (actor.role === 'faculty') {
      await assertFacultyOwnsCourse(actor.userId, actor.role, courseId);
    }
  } else if (actor.role === 'faculty') {
    // Faculty see rubrics on courses they own only.
    const { Course } = await import('../models/course.js');
    const owned = await Course.find({ facultyIds: actor.userId }).select('_id');
    filter.courseId = { $in: owned.map((c) => c._id) };
  }
  return Rubric.find(filter).sort({ createdAt: -1 });
}

export async function getRubric(
  actor: AuthContext,
  rubricId: string,
): Promise<HydratedRubric> {
  if (!Types.ObjectId.isValid(rubricId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    throw new HttpError(404, 'NOT_FOUND', 'Rubric not found.');
  }
  if (actor.role === 'faculty') {
    await assertFacultyOwnsCourse(actor.userId, actor.role, rubric.courseId);
  }
  return rubric;
}
