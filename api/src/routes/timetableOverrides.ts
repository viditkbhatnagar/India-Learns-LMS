import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createOverride,
  deleteOverride,
  toTimetableOverrideDto,
  updateOverride,
} from '../services/timetableOverrideService.js';

const CreateBody = z.object({
  batchId: z.string().min(1),
  entryId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(['cancel', 'reschedule', 'add']),
  newCourseId: z.string().min(1).nullable().optional(),
  newFacultyId: z.string().min(1).nullable().optional(),
  newStartMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  newEndMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  newRoom: z.string().max(80).nullable().optional(),
  reason: z.string().max(500).optional(),
});

const UpdateBody = z.object({
  action: z.enum(['cancel', 'reschedule', 'add']).optional(),
  newCourseId: z.string().min(1).nullable().optional(),
  newFacultyId: z.string().min(1).nullable().optional(),
  newStartMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  newEndMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  newRoom: z.string().max(80).nullable().optional(),
  reason: z.string().max(500).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function timetableOverridesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createOverride(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { override: toTimetableOverrideDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateOverride(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { override: toTimetableOverrideDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteOverride(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { override: toTimetableOverrideDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
