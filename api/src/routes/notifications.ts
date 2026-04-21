import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  listNotificationsForUser,
  markNotificationRead,
  toNotificationDto,
} from '../services/notificationService.js';

const MeQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export function notificationsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/me',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = MeQuery.parse(req.query);
        const items = await listNotificationsForUser(req.auth!.userId, {
          unreadOnly: q.unreadOnly === 'true',
          limit: q.limit,
        });
        res.status(200).json({ data: { items: items.map(toNotificationDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/read',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await markNotificationRead(
          req.params.id ?? '',
          req.auth!.userId,
        );
        res.status(200).json({ data: { notification: toNotificationDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
