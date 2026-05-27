import { Types } from 'mongoose';
import type {
  AssignmentStatus,
  StudentAssignmentDto,
  StudentCourseViewDto,
  StudentModuleDto,
  StudentSessionDto,
  StudentSessionState,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Assignment,
  AssignmentSubmission,
  Course,
  Material,
  ModuleModel,
  SessionModel,
  type AssignmentDoc,
  type AssignmentSubmissionDoc,
  type CourseDoc,
  type HydratedUser,
  type ModuleDoc,
} from '../models/index.js';
import { findCourseById } from './courseService.js';
import { assertStudentCanAccessCourse } from './moduleAccessService.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Map an assignment + the calling student's submission (if any) onto
 * the bucketed status the student-view UI keys off. Order matters —
 * a published grade beats everything else; otherwise a present
 * submission beats due-date lifecycle states.
 */
function deriveAssignmentStatus(
  assignment: AssignmentDoc,
  submission: AssignmentSubmissionDoc | null,
  now: Date,
): AssignmentStatus {
  if (submission && submission.status === 'published') return 'graded';
  if (submission) return 'submitted';
  const daysUntilDue = Math.floor(
    (assignment.dueAt.getTime() - now.getTime()) / MS_PER_DAY,
  );
  if (daysUntilDue < 0) return 'late';
  if (daysUntilDue <= 7) return 'dueSoon';
  return 'upcoming';
}

function deriveState(progress: {
  total: number;
  completed: number;
  late: number;
  dueSoon: number;
}): StudentSessionState {
  if (progress.total > 0 && progress.completed === progress.total) return 'complete';
  if (progress.completed > 0 || progress.late > 0 || progress.dueSoon > 0) {
    return 'in_progress';
  }
  return 'not_started';
}

function toAssignmentDto(
  a: AssignmentDoc,
  sub: AssignmentSubmissionDoc | null,
  now: Date,
): StudentAssignmentDto {
  const status = deriveAssignmentStatus(a, sub, now);
  const daysUntilDue = Math.floor(
    (a.dueAt.getTime() - now.getTime()) / MS_PER_DAY,
  );
  // Score + feedback only leak when status === 'published'. The
  // `assertStudentCanAccessCourse` gate plus this status check is the
  // exact same draft-leak guard the gradebook smoke locks down.
  const score = sub && sub.status === 'published' ? sub.score ?? null : null;
  const feedback = sub && sub.status === 'published' ? sub.feedback ?? null : null;
  return {
    id: a._id.toString(),
    title: a.title,
    dueAt: a.dueAt.toISOString(),
    maxPoints: a.maxScore,
    score,
    feedback,
    status,
    daysUntilDue,
  };
}

/**
 * One-shot loader for the student "your course" page. Returns a fully
 * nested Module → Session → Assignment tree with progress rollups and
 * a pre-sorted "needs attention" action list. All status / progress
 * derivation lives here so the client renders directly.
 */
export async function getStudentCourseView(
  student: HydratedUser,
  courseIdStr: string,
): Promise<StudentCourseViewDto> {
  if (!Types.ObjectId.isValid(courseIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const course = await findCourseById(courseIdStr);
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  // Reuse the canonical access gate: enrolled-and-active is the only
  // path through to a course's content surface (sandbox is reachable
  // for enrolled students per PR #14).
  const { enrolment } = await assertStudentCanAccessCourse(student, course);
  const courseDoc: CourseDoc = course;

  const [modules, sessions, assignments] = await Promise.all([
    ModuleModel.find({ courseId: courseDoc._id, deletedAt: null }).sort({ order: 1 }),
    SessionModel.find({ courseId: courseDoc._id, deletedAt: null }).sort({
      moduleId: 1,
      number: 1,
    }),
    Assignment.find({ courseId: courseDoc._id, deletedAt: null }).sort({ dueAt: 1 }),
  ]);

  const submissions = await AssignmentSubmission.find({
    studentId: student._id,
    assignmentId: { $in: assignments.map((a) => a._id) },
  });
  const subByAssignment = new Map<string, AssignmentSubmissionDoc>(
    submissions.map((s) => [s.assignmentId.toString(), s]),
  );

  const now = new Date();

  // First pass: bucket assignments by sessionId and build their DTOs.
  const allAssignmentDtos: Array<StudentAssignmentDto & { sessionId: string | null }> = [];
  for (const a of assignments) {
    const sub = subByAssignment.get(a._id.toString()) ?? null;
    const dto = toAssignmentDto(a, sub, now);
    allAssignmentDtos.push({ ...dto, sessionId: a.sessionId?.toString() ?? null });
  }
  const assignmentsBySession = new Map<string, StudentAssignmentDto[]>();
  for (const dto of allAssignmentDtos) {
    if (!dto.sessionId) continue;
    if (!assignmentsBySession.has(dto.sessionId)) {
      assignmentsBySession.set(dto.sessionId, []);
    }
    // Strip the synthetic sessionId tag — caller wants the public DTO shape.
    const { sessionId: _drop, ...pub } = dto;
    assignmentsBySession.get(dto.sessionId)!.push(pub);
  }

  // Second pass: bucket sessions by moduleId and build session DTOs.
  const sessionsByModule = new Map<string, StudentSessionDto[]>();
  for (const s of sessions) {
    const sessionAssignments = assignmentsBySession.get(s._id.toString()) ?? [];
    const progress = {
      total: sessionAssignments.length,
      completed: sessionAssignments.filter((a) => a.status === 'graded').length,
      late: sessionAssignments.filter((a) => a.status === 'late').length,
      dueSoon: sessionAssignments.filter((a) => a.status === 'dueSoon').length,
    };
    const dto: StudentSessionDto = {
      id: s._id.toString(),
      order: s.number,
      title: s.title,
      subtitle: s.description ?? '',
      state: deriveState(progress),
      status: s.status,
      scheduledStart: s.scheduledStart ? s.scheduledStart.toISOString() : null,
      scheduledEnd: s.scheduledEnd ? s.scheduledEnd.toISOString() : null,
      location: s.location ?? null,
      assignments: sessionAssignments,
      progress,
    };
    const mid = s.moduleId.toString();
    if (!sessionsByModule.has(mid)) sessionsByModule.set(mid, []);
    sessionsByModule.get(mid)!.push(dto);
  }

  // Third pass: build module DTOs.
  const moduleDtos: StudentModuleDto[] = modules.map((m: ModuleDoc) => {
    const moduleSessions = sessionsByModule.get(m._id.toString()) ?? [];
    const total = moduleSessions.reduce((sum, s) => sum + s.progress.total, 0);
    const completed = moduleSessions.reduce((sum, s) => sum + s.progress.completed, 0);
    const late = moduleSessions.reduce((sum, s) => sum + s.progress.late, 0);
    const dueSoon = moduleSessions.reduce((sum, s) => sum + s.progress.dueSoon, 0);
    return {
      id: m._id.toString(),
      order: m.order,
      title: m.title,
      // Module has no `subtitle` field — surface its `code` as the eyebrow.
      subtitle: m.code ?? '',
      aim: m.aim ?? '',
      syllabus: m.syllabus ?? '',
      syllabusFile: m.syllabusFile
        ? {
            fileId: m.syllabusFile.fileId.toString(),
            filename: m.syllabusFile.filename,
            contentType: m.syllabusFile.contentType,
            size: m.syllabusFile.size,
            uploadedAt:
              m.syllabusFile.uploadedAt instanceof Date
                ? m.syllabusFile.uploadedAt.toISOString()
                : new Date(m.syllabusFile.uploadedAt).toISOString(),
          }
        : null,
      state: deriveState({ total, completed, late, dueSoon }),
      sessions: moduleSessions,
      progress: { total, completed },
    };
  });

  // Course-level rollups.
  const totalAssignments = allAssignmentDtos.length;
  const completedAssignments = allAssignmentDtos.filter((a) => a.status === 'graded').length;
  const percentComplete = totalAssignments === 0
    ? 0
    : Math.round((completedAssignments / totalAssignments) * 100);
  const counts = {
    late: allAssignmentDtos.filter((a) => a.status === 'late').length,
    dueSoon: allAssignmentDtos.filter((a) => a.status === 'dueSoon').length,
    upcoming: allAssignmentDtos.filter((a) => a.status === 'upcoming').length,
  };
  const needsAttention = allAssignmentDtos
    .filter((a) => a.status === 'late' || a.status === 'dueSoon')
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 5)
    .map(({ sessionId: _drop, ...pub }) => pub);

  const currentModule = moduleDtos.find((m) => m.state === 'in_progress')
    ?? moduleDtos.find((m) => m.state === 'not_started')
    ?? moduleDtos[0];

  // SessionDoc has `description` and `notes` — `notes` are faculty-private
  // and never get included here; `description` is the safe student-facing
  // copy and is mapped above (`subtitle`). Type assertion left out
  // intentionally; `notes` is unreferenced by design.
  return {
    course: {
      id: courseDoc._id.toString(),
      title: courseDoc.name,
      slug: courseDoc.slug,
      state: courseDoc.state,
      description: courseDoc.summary ?? '',
    },
    enrolment: {
      id: enrolment._id.toString(),
      validFrom: enrolment.validFrom.toISOString(),
      validTo: enrolment.validTo.toISOString(),
      status: enrolment.status,
      accessState: enrolment.accessState,
      completed: Boolean(enrolment.completed),
    },
    progress: {
      totalAssignments,
      completedAssignments,
      percentComplete,
      currentModuleOrder: currentModule?.order ?? 1,
      currentModuleTitle: currentModule?.title ?? '',
    },
    counts,
    needsAttention,
    modules: moduleDtos,
  };
}

// =====================================================================
// Student-side session detail. Logan's UAT round 4: "you can see from
// the student view that they cannot click into the individual sessions".
// The aggregated student-view payload already includes per-session
// metadata + per-session assignments, but materials are only attached
// at the session-detail level. This loader fills that gap.
// =====================================================================

export interface StudentSessionMaterialDto {
  id: string;
  type: string;
  title: string;
  url: string | null;
  slideCount: number | null;
  /** For type=slides: the structured slide JSON. Other types: null. */
  body: unknown | null;
}

export interface StudentSessionDetailDto {
  course: { id: string; title: string };
  session: {
    id: string;
    moduleId: string;
    courseId: string;
    order: number;
    title: string;
    description: string;
    type: string;
    plannedMinutes: number | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    location: string | null;
    status: 'upcoming' | 'in_progress' | 'completed';
    completedAt: string | null;
  };
  materials: StudentSessionMaterialDto[];
  assignments: StudentAssignmentDto[];
}

export async function getStudentSessionDetail(
  student: HydratedUser,
  sessionIdStr: string,
): Promise<StudentSessionDetailDto> {
  if (!Types.ObjectId.isValid(sessionIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
  }
  const session = await SessionModel.findOne({
    _id: sessionIdStr,
    deletedAt: null,
  });
  if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found.');

  const course = await Course.findOne({ _id: session.courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Session not found.');

  // Same access gate as the rest of the student surface — sandbox is
  // OK for enrolled students (PR #14), non-enrolled get 404 / 403 by
  // course state.
  await assertStudentCanAccessCourse(student, course);

  const [materialDocs, assignmentDocs] = await Promise.all([
    Material.find({ sessionId: session._id, deletedAt: null }).sort({ uploadedAt: 1 }),
    Assignment.find({ sessionId: session._id, deletedAt: null }).sort({ dueAt: 1 }),
  ]);
  const submissions = await AssignmentSubmission.find({
    studentId: student._id,
    assignmentId: { $in: assignmentDocs.map((a) => a._id) },
  });
  const subByAssignment = new Map<string, AssignmentSubmissionDoc>(
    submissions.map((s) => [s.assignmentId.toString(), s]),
  );
  const now = new Date();
  const assignmentDtos: StudentAssignmentDto[] = assignmentDocs.map((a) =>
    toAssignmentDto(a, subByAssignment.get(a._id.toString()) ?? null, now),
  );

  return {
    course: { id: course._id.toString(), title: course.name },
    session: {
      id: session._id.toString(),
      moduleId: session.moduleId.toString(),
      courseId: session.courseId.toString(),
      order: session.number,
      title: session.title,
      description: session.description ?? '',
      type: session.type ?? 'lecture',
      plannedMinutes: session.plannedMinutes,
      scheduledStart: session.scheduledStart ? session.scheduledStart.toISOString() : null,
      scheduledEnd: session.scheduledEnd ? session.scheduledEnd.toISOString() : null,
      location: session.location ?? null,
      status: session.status,
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    },
    materials: materialDocs.map((m) => ({
      id: m._id.toString(),
      type: m.type as string,
      title: m.title,
      url: m.url,
      slideCount: m.slideCount,
      // Only ship the slide body for type=slides — other types have a
      // URL the client follows, no need to bloat the payload.
      body: m.type === 'slides' ? m.body : null,
    })),
    assignments: assignmentDtos,
  };
}
