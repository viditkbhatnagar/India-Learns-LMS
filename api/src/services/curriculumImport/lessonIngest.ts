import { Types } from 'mongoose';
import { HttpError } from '../../middleware/error.js';
import {
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  Course,
  Enrollment,
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
  // Superadmin (platform owner) and faculty (course owners) may ingest a
  // lesson plan. Faculty are further restricted below: they can only REPLACE a
  // course they teach, and a course they create is assigned to them. Admins are
  // deliberately excluded — they're read-only inside course content
  // ("oversight mode"), same as everywhere else in the app.
  const isFaculty = actor.role === 'faculty';
  if (actor.role !== 'superadmin' && !isFaculty) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Only a super admin or the teaching faculty can upload a lesson plan.',
    );
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
  // Validate the whole payload BEFORE touching the course — a replace destroys
  // the existing content, so it must never fail halfway on bad input.
  for (const m of input.modules) {
    if (!m.title?.trim()) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Every module needs a title.');
    }
    for (const l of m.lessons) {
      if (!l.title?.trim()) {
        throw new HttpError(422, 'VALIDATION_FAILED', `A lesson in "${m.title.trim()}" has no title.`);
      }
    }
  }

  let course;
  let created = false;
  // What the replace tombstoned, for the audit trail (recovery basis).
  let before: { modules: number; sessions: number; materials: number; assignments: number } | null = null;
  if (input.courseId) {
    if (!Types.ObjectId.isValid(input.courseId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'courseId is invalid.');
    }
    course = await Course.findOne({ _id: input.courseId, deletedAt: null });
    if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course to replace was not found.');
    // A faculty member may only overwrite a course they actually teach.
    if (isFaculty && !course.facultyIds.some((id) => id.equals(actor.userId))) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'You can only replace the lessons of a course you are assigned to teach.',
      );
    }
    // A generator-sourced course keeps its provenance unless a superadmin
    // decides otherwise — detaching it is a structural change.
    if (isFaculty && course.sourceWorkflowId) {
      throw new HttpError(
        409,
        'COURSE_FROM_GENERATOR',
        'This course was imported from the curriculum generator. Ask a super admin to switch it over to a document-based lesson plan.',
      );
    }

    // GUARD: replacing wipes the whole course, so refuse once real student
    // work exists — deleting sessions/assignments would strand attendance
    // records, submissions and grades that reference them.
    const [activeEnrolments, submissions, attendance] = await Promise.all([
      Enrollment.countDocuments({ courseId: course._id, status: 'active' }),
      AssignmentSubmission.countDocuments({ courseId: course._id }),
      AttendanceRecord.countDocuments({ courseId: course._id }),
    ]);
    if (activeEnrolments > 0 || submissions > 0 || attendance > 0) {
      const bits = [
        activeEnrolments > 0 ? `${activeEnrolments} enrolled student(s)` : '',
        submissions > 0 ? `${submissions} submission(s)` : '',
        attendance > 0 ? `${attendance} attendance record(s)` : '',
      ].filter(Boolean);
      throw new HttpError(
        409,
        'COURSE_IN_USE',
        `This course is already in use (${bits.join(', ')}). Replacing its lessons would delete work that students and staff depend on. Create a new course from this document instead, or ask support to migrate it.`,
      );
    }

    before = {
      modules: await ModuleModel.countDocuments({ courseId: course._id, deletedAt: null }),
      sessions: await SessionModel.countDocuments({ courseId: course._id, deletedAt: null }),
      materials: await Material.countDocuments({ courseId: course._id, deletedAt: null }),
      assignments: await Assignment.countDocuments({ courseId: course._id, deletedAt: null }),
    };

    // Soft-delete (never hard-delete) so a mistaken replace stays recoverable —
    // consistent with deleteCourse/deleteModule everywhere else in the app.
    const now = new Date();
    const tomb = { $set: { deletedAt: now } };
    await Promise.all([
      SessionModel.updateMany({ courseId: course._id, deletedAt: null }, tomb),
      ModuleModel.updateMany({ courseId: course._id, deletedAt: null }, tomb),
      Material.updateMany({ courseId: course._id, deletedAt: null }, tomb),
      Assignment.updateMany({ courseId: course._id, deletedAt: null }, tomb),
    ]);
    // Renaming + detaching provenance are structural: superadmin only.
    if (!isFaculty) {
      course.name = input.name.trim();
      course.sourceWorkflowId = null;
    }
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
      // A faculty member who uploads a plan owns the course they just made —
      // without this they'd create a course they aren't allowed to edit.
      facultyIds: isFaculty ? [actor.userId] : [],
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
    before,
    details: {
      source: 'lesson-plan-document',
      programId: String(program._id),
      modules: input.modules.length,
      lessons: lessonCount,
      replaced: !created,
      // Soft-deleted children remain queryable by courseId + deletedAt for recovery.
      tombstoned: before,
    },
  });

  return { courseId: String(course._id), created, modules: input.modules.length, lessons: lessonCount };
}
