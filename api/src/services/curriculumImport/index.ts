import { Types } from 'mongoose';
import { HttpError } from '../../middleware/error.js';
import { Program } from '../../models/index.js';
import type { AuthContext } from '../../middleware/auth.js';
import { recordAudit } from '../auditService.js';
import { fetchWorkflow, checkGeneratorHealth, listWorkflows, type WorkflowSummary } from './client.js';
import { isWorkflowComplete } from './schema.js';
import { transformWorkflow, type TransformedImport } from './transformer.js';
import { persistImport, type PersistResult } from './persister.js';

export { checkGeneratorHealth, fetchWorkflow };

/** Available curricula in the generator, for a self-serve picker. */
export async function listAvailableWorkflows(actor: AuthContext): Promise<WorkflowSummary[]> {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Curriculum import is super-admin only.');
  }
  return listWorkflows();
}

export interface PreviewResult {
  workflowId: string;
  workflowVersion: string;
  workflowStatus: string;
  course: { name: string; slug: string; summary: string };
  counts: {
    plos: number;
    modules: number;
    sessions: number;
    materials: number;
    assignments: number;
  };
  warnings: string[];
  alreadyImported: boolean;
  existingCourseId: string | null;
  existingLastSyncedAt: string | null;
  // True when the previous import landed partial state (lastSyncedAt is
  // null on the existing course). The UI surfaces this as a different
  // call-to-action: "Resume import" rather than "Replace existing".
  existingIsPartial: boolean;
}

export async function previewImport(
  actor: AuthContext,
  workflowId: string,
): Promise<PreviewResult> {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Curriculum import is super-admin only.');
  }
  const wf = await fetchWorkflow(workflowId);
  if (!isWorkflowComplete(wf)) {
    throw new HttpError(
      409,
      'WORKFLOW_NOT_COMPLETE',
      `Workflow ${workflowId} has no step13 summative exam — import refused.`,
    );
  }
  const transformed = transformWorkflow(wf);

  const { Course } = await import('../../models/index.js');
  const existing = await Course.findOne({
    sourceWorkflowId: wf._id,
    deletedAt: null,
  }).select('_id lastSyncedAt');

  return {
    workflowId: wf._id,
    workflowVersion: wf.updatedAt,
    workflowStatus: wf.status,
    course: {
      name: transformed.course.name,
      slug: transformed.course.slug,
      summary: transformed.course.summary.slice(0, 600),
    },
    counts: {
      plos: transformed.course.programLearningOutcomes.length,
      modules: transformed.modules.length,
      sessions: transformed.sessions.length,
      materials: transformed.materials.length,
      assignments: transformed.assignments.length,
    },
    warnings: transformed.warnings,
    alreadyImported: Boolean(existing),
    existingCourseId: existing ? String(existing._id) : null,
    existingLastSyncedAt: existing?.lastSyncedAt ? existing.lastSyncedAt.toISOString() : null,
    existingIsPartial: Boolean(existing) && !existing?.lastSyncedAt,
  };
}

export interface RunImportInput {
  workflowId: string;
  programId: string;
  replace?: boolean;
  /** Adopt + rebuild an existing course (see PersistOptions.adoptCourseId). */
  courseId?: string;
}

export interface RunImportResult extends PersistResult {
  workflowId: string;
}

export async function runImport(
  actor: AuthContext,
  input: RunImportInput,
  ctx: { ip?: string; ua?: string },
): Promise<RunImportResult> {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Curriculum import is super-admin only.');
  }
  if (!Types.ObjectId.isValid(input.programId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'programId is not a valid id.');
  }
  const program = await Program.findById(input.programId);
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');

  const wf = await fetchWorkflow(input.workflowId);
  if (!isWorkflowComplete(wf)) {
    throw new HttpError(
      409,
      'WORKFLOW_NOT_COMPLETE',
      `Workflow ${input.workflowId} has no step13 summative exam — import refused.`,
    );
  }
  const transformed: TransformedImport = transformWorkflow(wf);

  const result = await persistImport(transformed, {
    programId: program._id,
    importerUserId: actor.userId,
    replace: input.replace ?? false,
    adoptCourseId: input.courseId,
  });

  await recordAudit({
    actorUserId: actor.userId,
    action: 'curriculum.imported',
    targetType: 'Course',
    targetId: result.courseId,
    details: {
      workflowId: wf._id,
      workflowVersion: wf.updatedAt,
      programId: String(program._id),
      replace: Boolean(input.replace),
      counts: result.created,
      warnings: result.warnings,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return { ...result, workflowId: wf._id };
}
