import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  enrolStudentInProgram,
  listEnrollments,
  listEnrollmentsForStudent,
  toEnrollmentDto,
  updateEnrollment,
} from '../services/enrollmentService.js';

const CreateBody = z.object({
  studentId: z.string().min(1),
  programId: z.string().min(1),
  batchId: z.string().min(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
});

const UpdateBody = z.object({
  batchId: z.string().optional(),
  validTo: z.string().datetime().optional(),
  completed: z.boolean().optional(),
  status: z.literal('revoked').optional(),
  accessState: z.enum(['active', 'warn1', 'warn2', 'override', 'suspended']).optional(),
});

const ListQuery = z.object({
  studentId: z.string().optional(),
  batchId: z.string().optional(),
  courseId: z.string().optional(),
  status: z.enum(['active', 'expired', 'revoked']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function enrollmentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/me',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await listEnrollmentsForStudent(req.auth!.userId);
        res.status(200).json({ data: { enrolments: docs.map(toEnrollmentDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const created = await enrolStudentInProgram(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({
          data: {
            enrolments: created.map(toEnrollmentDto),
            count: created.length,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListQuery.parse(req.query);
        const result = await listEnrollments(query);
        res.status(200).json({
          data: {
            items: result.items.map(toEnrollmentDto),
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateEnrollment(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { enrolment: toEnrollmentDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
