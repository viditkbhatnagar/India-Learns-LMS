import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  Announcement,
  Course,
  Enrollment,
  type HydratedAnnouncement,
  type HydratedCourse,
} from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { recordAudit } from '../services/auditService.js';

const CreateBody = z.object({
  subject: z.string().min(1).max(240),
  body: z.string().min(1).max(4000),
});

function toDto(doc: HydratedAnnouncement) {
  return {
    id: doc._id.toString(),
    // M10j — courseId is nullable on the model now (broad-scope
    // announcements). The legacy course router only ever creates with
    // courseId set, so this is non-null for any doc returned here.
    courseId: doc.courseId ? doc.courseId.toString() : '',
    authorUserId: doc.authorUserId.toString(),
    subject: doc.subject,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Mounted at /v1/courses/:courseId/announcements.
 *  - GET: faculty assigned to the course OR a student enrolled on it.
 *  - POST: faculty assigned to the course (or admin/superadmin).
 */
export function courseAnnouncementsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  // Viewer gate used by GET/POST — resolves + checks access.
  async function requireCourseAccess(
    req: Request,
  ): Promise<{ course: HydratedCourse; mayWrite: boolean }> {
    const { courseId } = req.params as { courseId: string };
    if (!Types.ObjectId.isValid(courseId)) {
      throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
    }
    const course = await Course.findOne({ _id: courseId, deletedAt: null });
    if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');

    const { role } = req.auth!;
    const { userId } = req.auth!;
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isAssignedFaculty =
      role === 'faculty' && course.facultyIds.some((id) => id.equals(userId));

    if (role === 'student') {
      const enrolment = await Enrollment.findOne({
        studentId: userId,
        courseId: course._id,
        status: 'active',
      });
      if (!enrolment) {
        throw new HttpError(403, 'FORBIDDEN', 'Not enrolled in this course.');
      }
      return { course, mayWrite: false };
    }
    if (!isAdmin && !isAssignedFaculty) {
      throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
    }
    return { course, mayWrite: true };
  }

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { course } = await requireCourseAccess(req);
        const announcements = await Announcement.find({
          courseId: course._id,
          deletedAt: null,
        })
          .sort({ createdAt: -1 })
          .limit(100);
        res.json({ data: { items: announcements.map(toDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { course, mayWrite } = await requireCourseAccess(req);
        if (!mayWrite) {
          throw new HttpError(403, 'FORBIDDEN', 'Cannot post announcements.');
        }
        const body = CreateBody.parse(req.body);
        const doc = await Announcement.create({
          courseId: course._id,
          authorUserId: req.auth!.userId,
          subject: body.subject.trim(),
          body: body.body.trim(),
        });
        await recordAudit({
          actorUserId: req.auth!.userId,
          action: 'announcement.created',
          targetType: 'Announcement',
          targetId: doc._id,
          after: doc.toObject(),
          details: { courseId: course._id.toString() },
          ip: req.ip,
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { announcement: toDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
