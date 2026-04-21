import { HttpError } from '../middleware/error.js';
import {
  Course,
  Enrollment,
  type HydratedCourse,
  type HydratedEnrollment,
  type HydratedModule,
  type HydratedUser,
} from '../models/index.js';
import { recordAudit } from './auditService.js';

export interface CourseAccessContext {
  course: HydratedCourse;
  enrolment: HydratedEnrollment;
}

/**
 * Gate a student's right to see a published course's content surface (modules,
 * videos, PDFs). Used both for the per-module GET and for any catalog-style
 * endpoint that exposes module URLs (e.g. GET /v1/me/courses/:courseId).
 *
 * Ordering:
 *   1. Course exists and not soft-deleted            → else NOT_FOUND (404)
 *   2. Course is published                           → else NOT_FOUND (404) (hide sandbox)
 *   3. Student has an active enrolment on it         → else NOT_ENROLLED (403)
 *   4. Enrolment program matches course program      → else FORBIDDEN (403)
 *   5. enrolment.validTo > now                       → else ENROLMENT_EXPIRED (403)
 *                                                      (also flips status='expired' so M5 cron can reconcile)
 *   6. enrolment.accessState !== 'suspended'         → else SUSPENDED_ACCESS (403)
 */
export async function assertStudentCanAccessCourse(
  student: HydratedUser,
  course: HydratedCourse,
): Promise<CourseAccessContext> {
  if (course.deletedAt) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (course.state !== 'published') {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }

  const enrolment = await Enrollment.findOne({
    studentId: student._id,
    courseId: course._id,
    status: 'active',
  });
  if (!enrolment) {
    throw new HttpError(403, 'NOT_ENROLLED', 'You are not enrolled in this course.');
  }

  if (!enrolment.programId.equals(course.programId)) {
    throw new HttpError(403, 'FORBIDDEN', 'Enrolment/program mismatch.');
  }

  const now = new Date();
  if (enrolment.validTo <= now) {
    enrolment.status = 'expired';
    await enrolment.save().catch(() => undefined);
    throw new HttpError(403, 'ENROLMENT_EXPIRED', 'Your enrolment has expired.');
  }

  if (enrolment.accessState === 'suspended') {
    throw new HttpError(
      403,
      'SUSPENDED_ACCESS',
      'Your course access is suspended — contact Finance.',
    );
  }

  return { course, enrolment };
}

/**
 * Thin wrapper around {@link assertStudentCanAccessCourse} for a given module.
 * Loads the parent course and delegates.
 */
export async function assertStudentCanViewModule(
  student: HydratedUser,
  module: HydratedModule,
): Promise<CourseAccessContext> {
  const course = await Course.findOne({ _id: module.courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
  try {
    return await assertStudentCanAccessCourse(student, course);
  } catch (err) {
    // Surface "course hidden" as a module-404 (keeps the client from learning
    // about sandbox courses by probing module IDs).
    if (
      err instanceof HttpError &&
      err.status === 404 &&
      err.code === 'NOT_FOUND'
    ) {
      throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
    }
    throw err;
  }
}

export async function recordModuleViewed(
  student: HydratedUser,
  module: HydratedModule,
  ctx: CourseAccessContext,
  request: { ip?: string; ua?: string } = {},
): Promise<void> {
  await recordAudit({
    actorUserId: student._id,
    action: 'module.viewed',
    targetType: 'Module',
    targetId: module._id,
    before: null,
    after: null,
    details: {
      courseId: ctx.course._id.toString(),
      enrolmentId: ctx.enrolment._id.toString(),
    },
    ip: request.ip ?? '',
    ua: request.ua ?? '',
  });
}

// Back-compat alias — some call sites imported this name.
export type ModuleAccessContext = CourseAccessContext;
