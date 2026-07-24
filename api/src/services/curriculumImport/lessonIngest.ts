import { Types } from 'mongoose';
import { HttpError } from '../../middleware/error.js';
import {
  Assignment,
  Course,
  Material,
  ModuleModel,
  Program,
  SessionModel,
} from '../../models/index.js';
import type { AuthContext } from '../../middleware/auth.js';
import { recordAudit } from '../auditService.js';
import { slugify } from '../../utils/slug.js';

// Ingest a hand-finalized lesson plan (from a Word document) into a course.
// Unlike the generator import, the DOCUMENT is the full source of truth: on
// replace we wipe every child and rebuild from the parsed modules/lessons.
// Lessons get sourceLessonId=null + synthesized=false, and the course is
// detached from any generator workflow, so the two sources never fight.

export interface IngestLesson {
  title: string;
  plannedMinutes?: number | null;
  description?: string;
  objectives?: string[];
}
export interface IngestModule {
  title: string;
  lessons: IngestLesson[];
}
export interface IngestLessonPlanInput {
  programId: string;
  name: string;
  slug?: string;
  /** When set, replace this existing course's lessons; otherwise create a new course. */
  courseId?: string;
  modules: IngestModule[];
}
export interface IngestLessonPlanResult {
  courseId: string;
  created: boolean;
  modules: number;
  lessons: number;
}

const MAX_LESSONS = 2000;

export async function ingestLessonPlan(
  input: IngestLessonPlanInput,
  actor: AuthContext,
): Promise<IngestLessonPlanResult> {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Lesson-plan import is super-admin only.');
  }
  if (!Types.ObjectId.isValid(input.programId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'programId is invalid.');
  }
  const program = await Program.findOne({ _id: input.programId, deletedAt: null });
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');

  const totalLessons = input.modules.reduce((n, m) => n + m.lessons.length, 0);
  if (input.modules.length === 0 || totalLessons === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'No modules or lessons were found in the document.');
  }
  if (totalLessons > MAX_LESSONS) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Too many lessons (${totalLessons}); max ${MAX_LESSONS}.`);
  }

  let course;
  let created = false;
  if (input.courseId) {
    if (!Types.ObjectId.isValid(input.courseId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'courseId is invalid.');
    }
    course = await Course.findOne({ _id: input.courseId, deletedAt: null });
    if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course to replace was not found.');
    // The document is the full source of truth — remove every child first.
    await Promise.all([
      SessionModel.deleteMany({ courseId: course._id }),
      ModuleModel.deleteMany({ courseId: course._id }),
      Material.deleteMany({ courseId: course._id }),
      Assignment.deleteMany({ courseId: course._id }),
    ]);
    course.name = input.name.trim();
    // Detach from the generator so a later workflow re-import can't clobber
    // the document-sourced content (it would create a separate course).
    course.sourceWorkflowId = null;
    course.lastSyncedAt = new Date();
    await course.save();
  } else {
    const slug = (input.slug && slugify(input.slug)) || slugify(input.name);
    if (!slug) throw new HttpError(422, 'VALIDATION_FAILED', 'Could not derive a slug from the course name.');
    const clash = await Course.findOne({ programId: program._id, slug, deletedAt: null });
    if (clash) {
      throw new HttpError(
        409,
        'SLUG_EXISTS',
        `A course "${clash.name}" already exists in this program — replace it instead of creating a new one.`,
      );
    }
    course = await Course.create({
      programId: program._id,
      name: input.name.trim(),
      slug,
      state: 'sandbox',
      lastSyncedAt: new Date(),
    });
    created = true;
  }

  let lessonCount = 0;
  for (let mi = 0; mi < input.modules.length; mi += 1) {
    const m = input.modules[mi]!;
    const moduleDoc = await ModuleModel.create({
      courseId: course._id,
      title: (m.title || `Module ${mi + 1}`).trim().slice(0, 200),
      order: mi,
      content: [],
    });
    const sessions = m.lessons.map((l, li) => ({
      moduleId: moduleDoc._id,
      courseId: course._id,
      number: li + 1,
      title: (l.title || `Lesson ${li + 1}`).trim().slice(0, 240),
      description: (l.description ?? '').slice(0, 8000),
      type: null,
      plannedMinutes: l.plannedMinutes ?? null,
      status: 'upcoming',
      notes: '',
      sourceLessonId: null,
      linkedMLOs: [],
      bloomLevel: null,
      objectives: (l.objectives ?? []).map((o) => o.slice(0, 2000)).slice(0, 60),
      activities: [],
      formativeChecks: [],
      synthesized: false,
    }));
    if (sessions.length) {
      await SessionModel.insertMany(sessions, { ordered: true });
    }
    lessonCount += sessions.length;
  }

  await recordAudit({
    actorUserId: actor.userId,
    action: 'curriculum.imported',
    targetType: 'Course',
    targetId: course._id,
    details: {
      source: 'lesson-plan-document',
      programId: String(program._id),
      modules: input.modules.length,
      lessons: lessonCount,
      replaced: !created,
    },
  });

  return { courseId: String(course._id), created, modules: input.modules.length, lessons: lessonCount };
}
