import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getOrCreatePrefsForUser,
  toNotificationPrefsDto,
  updatePrefsForUser,
} from '../services/notificationPrefsService.js';
import {
  listNotificationsForUser,
  markNotificationRead,
  toNotificationDto,
} from '../services/notificationService.js';

const MeQuery = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const UpdatePrefsBody = z.object({
  emailByType: z.record(z.string(), z.boolean()).optional(),
  whatsappByType: z.record(z.string(), z.boolean()).optional(),
});

// M8 — TRD §5.11 canonical path router for /v1/me/notifications + reads. The
// M4 `/v1/notifications/me` router remains mounted as an alias (same pattern
// as M6 /v1/me/tickets + /v1/tickets/me).
export function meNotificationsAliasRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
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
  });

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

export function notificationPrefsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await getOrCreatePrefsForUser(req.auth!.userId);
      res.status(200).json({ data: toNotificationPrefsDto(doc) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdatePrefsBody.parse(req.body);
      const doc = await updatePrefsForUser({
        userId: req.auth!.userId,
        emailByType: body.emailByType,
        whatsappByType: body.whatsappByType,
      });
      res.status(200).json({ data: toNotificationPrefsDto(doc) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
