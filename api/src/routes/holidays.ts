import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createHoliday,
  deleteHoliday,
  listHolidaysInRange,
  toHolidayDto,
} from '../services/holidayService.js';

const CreateBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(160),
  kind: z.enum(['public', 'institutional']).optional(),
});

const ListQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function holidaysRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = ListQuery.parse(req.query);
        const from = q.from ?? '1970-01-01';
        const to = q.to ?? '2999-12-31';
        const items = await listHolidaysInRange(from, to);
        res.status(200).json({ data: { items: items.map(toHolidayDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createHoliday(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { holiday: toHolidayDto(doc) } });
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
        const doc = await deleteHoliday(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { holiday: toHolidayDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
