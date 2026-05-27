import type { Types } from 'mongoose';
import { HttpError } from '../../middleware/error.js';
import {
  Assignment,
  Course,
  Material,
  ModuleModel,
  SessionModel,
} from '../../models/index.js';
import { logger } from '../../config/logger.js';
import type { TransformedImport } from './transformer.js';

// Persist a transformed curriculum import.
//
// We deliberately do NOT use a Mongo transaction. The slide payload (1300+
// nested slide objects across 98 decks) plus 100+ session inserts on Atlas
// dev exceeds the default `transactionLifetimeLimitSeconds` (60s). Instead
// we rely on:
//
//   1. Idempotency keys via unique sparse indexes on `sourceModuleId`,
//      `sourceLessonId`, `sourceDeckId`, `sourceAssignmentPackId`.
//   2. The Course's `lastSyncedAt` as the consistency marker — set last,
//      after every child has landed. A null `lastSyncedAt` after a failed
//      import tells the operator the data is partial.
//   3. Explicit `replace: true` semantics: wipe imported children first,
//      then re-insert. Manually-created children (no `sourceXxxId`) are
//      preserved.
//
// If a partial failure happens, re-running with replace=true cleans up.

export interface PersistOptions {
  programId: Types.ObjectId;
  importerUserId: Types.ObjectId;
  replace: boolean;
}

export interface PersistResult {
  courseId: Types.ObjectId;
  created: {
    course: boolean;
    modules: number;
    sessions: number;
    materials: number;
    assignments: number;
  };
  warnings: string[];
}

const DAY_MS = 86_400_000;

export async function persistImport(
  data: TransformedImport,
  opts: PersistOptions,
): Promise<PersistResult> {
  const now = new Date();

  // 1. Find existing course by sourceWorkflowId — including soft-deleted
  // ones. If the operator soft-deleted the old course to "put the
  // updated version", the next import should revive that course in
  // place (preserving _id + slug + sourceWorkflowId so enrolments,
  // audit logs, and stored URLs keep working) rather than fail on the
  // programId+slug unique index.
  const existing = await Course.findOne({
    sourceWorkflowId: data.course.sourceWorkflowId,
  });

  // Soft-deleted records signal "I want a fresh import" more strongly
  // than the replace=true flag does, so trigger the replace path
  // automatically.
  const revivingDeleted = Boolean(existing?.deletedAt);

  // Partial-state detection: a course with lastSyncedAt=null left behind
  // by a prior import that threw mid-flight. Re-run as if replace=true so
  // the operator doesn't have to know about an internal flag — they just
  // want their import to land. Surface the auto-recovery in warnings so
  // the audit trail is honest.
  const autoRepair = Boolean(existing && existing.lastSyncedAt === null);
  const effectiveReplace = opts.replace || autoRepair || revivingDeleted;

  if (existing && !effectiveReplace) {
    return {
      courseId: existing._id,
      created: { course: false, modules: 0, sessions: 0, materials: 0, assignments: 0 },
      warnings: [
        `Course already imported from this workflow on ${existing.lastSyncedAt?.toISOString() ?? 'unknown'}; pass replace=true to overwrite.`,
        ...data.warnings,
      ],
    };
  }

  let courseDoc;
  let createdCourse = false;
  const recoveryWarnings: string[] = [];
  if (existing) {
    if (autoRepair) {
      recoveryWarnings.push(
        'Detected a prior import on this workflow that did not finish (lastSyncedAt was null). Auto-recovering by wiping the partial children and re-running the import — no replace=true required.',
      );
      logger.warn(
        { courseId: String(existing._id), workflowId: data.course.sourceWorkflowId },
        'curriculum.import.auto_repair',
      );
    }
    if (revivingDeleted) {
      recoveryWarnings.push(
        `Reviving previously deleted course (deletedAt=${existing.deletedAt?.toISOString() ?? 'unknown'}) for this workflow. Existing enrolments and audit history remain linked to the same course _id.`,
      );
      logger.warn(
        {
          courseId: String(existing._id),
          workflowId: data.course.sourceWorkflowId,
          previouslyDeletedAt: existing.deletedAt?.toISOString(),
        },
        'curriculum.import.revive_deleted',
      );
    }
    // Wipe imported children. Manually-created (no source*Id) children are
    // preserved so faculty edits aren't lost.
    await Material.deleteMany({
      courseId: existing._id,
      sourceDeckId: { $type: 'string' },
    });
    await Assignment.deleteMany({
      courseId: existing._id,
      sourceAssignmentPackId: { $type: 'string' },
    });
    await SessionModel.deleteMany({
      courseId: existing._id,
      $or: [{ sourceLessonId: { $type: 'string' } }, { synthesized: true }],
    });
    await ModuleModel.deleteMany({
      courseId: existing._id,
      sourceModuleId: { $type: 'string' },
    });
    existing.name = data.course.name;
    existing.summary = data.course.summary;
    existing.programLearningOutcomes = data.course.programLearningOutcomes;
    existing.sourceWorkflowVersion = data.course.sourceWorkflowVersion;
    if (revivingDeleted) {
      // Revive: clear the tombstone and force back to sandbox so the
      // operator can review the freshly re-imported content before
      // republishing. deleteCourse() also flips state to 'sandbox', so
      // this is just symmetry.
      existing.deletedAt = null;
      existing.state = 'sandbox';
    }
    // Mark partial until children are re-persisted.
    existing.lastSyncedAt = null;
    await existing.save();
    courseDoc = existing;
  } else {
    courseDoc = await Course.create({
      programId: opts.programId,
      name: data.course.name,
      slug: data.course.slug,
      summary: data.course.summary,
      state: 'sandbox',
      sequential: false,
      publishedAt: null,
      publishedVersion: 0,
      facultyIds: [],
      sourceWorkflowId: data.course.sourceWorkflowId,
      sourceWorkflowVersion: data.course.sourceWorkflowVersion,
      lastSyncedAt: null, // set at the end
      programLearningOutcomes: data.course.programLearningOutcomes,
    });
    createdCourse = true;
  }

  // 2. Modules. Each step records its actual persisted count + logs at
  // INFO so the operator (and the audit row) sees exactly how many rows
  // landed. If an insert throws mid-batch (typically a unique-index
  // collision), the prefix that succeeded is preserved on the course
  // (lastSyncedAt remains null marking partial), and the next import
  // call auto-recovers via the autoRepair branch above.
  const persistedCounts = { modules: 0, sessions: 0, materials: 0, assignments: 0 };
  const moduleKeyToId = new Map<string, Types.ObjectId>();
  if (data.modules.length > 0) {
    const moduleDocs = await ModuleModel.insertMany(
      data.modules.map((m) => ({
        courseId: courseDoc._id,
        title: m.title,
        order: m.order,
        content: [],
        sourceModuleId: m.sourceModuleId,
        code: m.code,
        coreElective: m.coreElective,
        aim: m.aim,
        prerequisites: m.prerequisites,
        learningOutcomes: m.learningOutcomes,
        totalHours: m.totalHours,
        contactHours: m.contactHours,
        selfStudyHours: m.selfStudyHours,
      })),
      { ordered: true },
    );
    moduleDocs.forEach((doc, i) => {
      const original = data.modules[i]!;
      moduleKeyToId.set(original.key, doc._id);
    });
    persistedCounts.modules = moduleDocs.length;
    logger.info(
      { courseId: String(courseDoc._id), planned: data.modules.length, persisted: moduleDocs.length },
      'curriculum.import.modules',
    );
  }

  // 3. Sessions.
  const sessionKeyToId = new Map<string, Types.ObjectId>();
  if (data.sessions.length > 0) {
    const sessionDocs = await SessionModel.insertMany(
      data.sessions.map((s) => {
        const moduleId = moduleKeyToId.get(s.moduleKey);
        if (!moduleId) {
          throw new HttpError(
            500,
            'IMPORT_FAILED',
            `Session ${s.sessionKey} references unknown module ${s.moduleKey}.`,
          );
        }
        return {
          moduleId,
          courseId: courseDoc._id,
          number: s.number,
          title: s.title,
          description: s.description,
          type: s.type,
          plannedMinutes: s.plannedMinutes,
          status: 'upcoming',
          notes: s.notes,
          sourceLessonId: s.sourceLessonId,
          linkedMLOs: s.linkedMLOs,
          bloomLevel: s.bloomLevel,
          objectives: s.objectives,
          activities: s.activities,
          formativeChecks: s.formativeChecks,
          synthesized: s.synthesized,
        };
      }),
      { ordered: true },
    );
    sessionDocs.forEach((doc, i) => {
      const original = data.sessions[i]!;
      sessionKeyToId.set(original.sessionKey, doc._id);
    });
    persistedCounts.sessions = sessionDocs.length;
    logger.info(
      { courseId: String(courseDoc._id), planned: data.sessions.length, persisted: sessionDocs.length },
      'curriculum.import.sessions',
    );
  }

  // 4. Materials (slides per session) — chunked, since this is the heavy
  // payload (1000+ nested slide objects).
  if (data.materials.length > 0) {
    const docs = data.materials.map((m) => {
      const base = {
        courseId: courseDoc._id,
        type: m.type,
        title: m.title,
        body: m.body,
        url: m.url,
        sizeBytes: m.sizeBytes,
        expectedHours: m.expectedHours,
        sourceDeckId: m.sourceDeckId,
        sourceLessonId: m.sourceLessonId,
        slideCount: m.slideCount,
        uploadedBy: opts.importerUserId,
        uploadedAt: now,
      };
      if (m.scope === 'session') {
        const sid = sessionKeyToId.get(m.sessionKey!);
        if (!sid) {
          throw new HttpError(
            500,
            'IMPORT_FAILED',
            `Material '${m.title}' references unknown session ${m.sessionKey}.`,
          );
        }
        return { ...base, sessionId: sid, assignmentId: null, moduleId: null };
      }
      if (m.scope === 'module') {
        const mid = moduleKeyToId.get(m.moduleKey!);
        if (!mid) {
          throw new HttpError(
            500,
            'IMPORT_FAILED',
            `Material '${m.title}' references unknown module ${m.moduleKey}.`,
          );
        }
        return { ...base, sessionId: null, assignmentId: null, moduleId: mid };
      }
      throw new HttpError(500, 'IMPORT_FAILED', 'Unknown material scope.');
    });
    const CHUNK = 25;
    let materialsPersisted = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const written = await Material.insertMany(slice, { ordered: true });
      materialsPersisted += written.length;
    }
    persistedCounts.materials = materialsPersisted;
    logger.info(
      { courseId: String(courseDoc._id), planned: data.materials.length, persisted: materialsPersisted },
      'curriculum.import.materials',
    );
  }

  // 5. Assignments.
  if (data.assignments.length > 0) {
    const assignmentDocs = await Assignment.insertMany(
      data.assignments.map((a) => {
        const sid = sessionKeyToId.get(a.sessionKey);
        if (!sid) {
          throw new HttpError(
            500,
            'IMPORT_FAILED',
            `Assignment ${a.assignmentKey} references unknown session ${a.sessionKey}.`,
          );
        }
        const mid = a.moduleKey ? moduleKeyToId.get(a.moduleKey) ?? null : null;
        return {
          courseId: courseDoc._id,
          moduleId: mid,
          sessionId: sid,
          authorUserId: opts.importerUserId,
          title: a.title,
          instructions: a.instructions || a.title,
          dueAt: new Date(now.getTime() + a.dueAtOffsetDays * DAY_MS),
          maxScore: a.maxScore,
          state: 'open',
          sourceAssignmentPackId: a.sourceAssignmentPackId,
          deliveryVariant: a.deliveryVariant,
          assignmentType: a.assignmentType,
          weighting: a.weighting,
          linkedMLOs: a.linkedMLOs,
          submissionRequirements: a.submissionRequirements,
          rubric: a.rubric,
          sectionBreakdown: a.sectionBreakdown,
        };
      }),
      { ordered: true },
    );
    persistedCounts.assignments = assignmentDocs.length;
    logger.info(
      { courseId: String(courseDoc._id), planned: data.assignments.length, persisted: assignmentDocs.length },
      'curriculum.import.assignments',
    );
  }

  // 6. Mark course consistent. This is the only "lastSyncedAt" write — if
  // any earlier step threw, the course is left with lastSyncedAt=null and
  // the operator's next import call hits the autoRepair branch above.
  courseDoc.lastSyncedAt = now;
  await courseDoc.save();

  // Surface a planned-vs-persisted gap in the warnings so the UI can
  // display "X modules, Y sessions, Z materials, W assignments persisted"
  // and the operator sees if anything fell off (shouldn't happen with
  // ordered:true semantics — that throws — but a gap would be a real
  // signal worth flagging if the bulk-write semantics ever change).
  const gap: string[] = [];
  if (persistedCounts.modules !== data.modules.length) {
    gap.push(`modules: planned ${data.modules.length}, persisted ${persistedCounts.modules}`);
  }
  if (persistedCounts.sessions !== data.sessions.length) {
    gap.push(`sessions: planned ${data.sessions.length}, persisted ${persistedCounts.sessions}`);
  }
  if (persistedCounts.materials !== data.materials.length) {
    gap.push(`materials: planned ${data.materials.length}, persisted ${persistedCounts.materials}`);
  }
  if (persistedCounts.assignments !== data.assignments.length) {
    gap.push(`assignments: planned ${data.assignments.length}, persisted ${persistedCounts.assignments}`);
  }
  const gapWarnings = gap.length > 0 ? [`Persisted-vs-planned gap detected: ${gap.join('; ')}`] : [];

  logger.info(
    {
      courseId: String(courseDoc._id),
      created: createdCourse,
      autoRepair,
      ...persistedCounts,
    },
    'curriculum.import.persisted',
  );

  return {
    courseId: courseDoc._id,
    created: {
      course: createdCourse,
      modules: persistedCounts.modules,
      sessions: persistedCounts.sessions,
      materials: persistedCounts.materials,
      assignments: persistedCounts.assignments,
    },
    warnings: [...recoveryWarnings, ...data.warnings, ...gapWarnings],
  };
}
