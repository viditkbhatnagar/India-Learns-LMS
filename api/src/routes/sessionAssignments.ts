import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  Assignment,
  Enrollment,
  SessionModel,
} from '../models/index.js';
import { recordAudit } from '../services/auditService.js';
import { enqueueNotification } from '../services/notificationService.js';
import { assertFacultyCanWriteCourse } from '../services/authzService.js';

const STAFF_ROLES = ['faculty', 'admin', 'superadmin'] as const;

const CreateSessionAssignmentBody = z.object({
  title: z.string().min(1).max(240),
  instructions: z.string().min(1).max(8000),
  dueAt: z.string().datetime(),
  maxScore: z.number().int().min(1).max(1000),
});

/**
 * Mounted at /v1/sessions/:sessionId/assignments. PR #16 Phase 2 —
 * faculty can attach an assignment directly to a session (the "Need
 * the ability to upload additional materials and additional
 * assignments" UAT ask). The course-level
 * /v1/courses/:id/assignments endpoint stays for module-level or
 * unscoped assignments.
 */
export function sessionAssignmentsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionIdStr = req.params.sessionId ?? '';
      if (!Types.ObjectId.isValid(sessionIdStr)) {
        throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
      }
      const session = await SessionModel.findOne({
        _id: sessionIdStr,
        deletedAt: null,
      }).select('_id courseId moduleId');
      if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found.');

      // Oversight is read-only — admin/superadmin not on facultyIds get
      // a clean OVERSIGHT_READONLY rather than a silent insert.
      await assertFacultyCanWriteCourse(req.auth!.userId, req.auth!.role, session.courseId);

      const body = CreateSessionAssignmentBody.parse(req.body);
      const doc = await Assignment.create({
        courseId: session.courseId,
        moduleId: session.moduleId,
        sessionId: session._id,
        authorUserId: req.auth!.userId,
        title: body.title.trim(),
        instructions: body.instructions.trim(),
        dueAt: new Date(body.dueAt),
        maxScore: body.maxScore,
        state: 'open',
      });

      await recordAudit({
        actorUserId: req.auth!.userId,
        action: 'assignment.created',
        targetType: 'Assignment',
        targetId: doc._id,
        after: doc.toObject(),
        details: {
          courseId: session.courseId.toString(),
          sessionId: session._id.toString(),
        },
        ip: req.ip ?? '',
        ua: req.header('user-agent') ?? '',
      });

      // Notify enrolled students. Best-effort; mirrors the course-level
      // assignment-create path. Students see a "New assignment" pill.
      try {
        const enrolments = await Enrollment.find({
          courseId: session.courseId,
          status: 'active',
        }).select('studentId');
        const recipients = enrolments.map((e) => e.studentId);
        if (recipients.length > 0) {
          await enqueueNotification({
            type: 'assignment.created',
            recipients,
            title: `New assignment: ${doc.title}`,
            body: `Due ${doc.dueAt.toISOString().slice(0, 10)}`,
            data: {
              assignmentId: doc._id.toString(),
              courseId: session.courseId.toString(),
              sessionId: session._id.toString(),
            },
          });
        }
      } catch {
        // non-fatal
      }

      res.status(201).json({
        data: {
          assignment: {
            id: doc._id.toString(),
            courseId: doc.courseId.toString(),
            sessionId: doc.sessionId?.toString() ?? null,
            moduleId: doc.moduleId?.toString() ?? null,
            authorUserId: doc.authorUserId.toString(),
            title: doc.title,
            instructions: doc.instructions,
            dueAt: doc.dueAt.toISOString(),
            maxScore: doc.maxScore,
            state: doc.state,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString(),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
