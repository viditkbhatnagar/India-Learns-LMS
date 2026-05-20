import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createBroadcastAnnouncement,
  listAnnouncementsForUser,
} from '../services/announcementService.js';

// M10j — Broad-scope announcement routes (LMS_Requirements §2). Lives
// alongside the legacy course-scoped /v1/courses/:id/announcements
// router; this one handles global / program / batch scopes.

const CreateBroadcastBody = z.object({
  scope: z.enum(['batch', 'program', 'global']),
  programId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
  subject: z.string().min(1).max(240),
  body: z.string().min(1).max(4000),
});

export function broadcastAnnouncementsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Create — admin/superadmin/faculty (faculty is further gated in
  // the service to their teaching batches).
  router.post(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBroadcastBody.parse(req.body);
        const doc = await createBroadcastAnnouncement(body, {
          userId: req.auth!.userId,
          role: req.auth!.role,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { announcement: { id: doc._id.toString() } } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function meAnnouncementsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listAnnouncementsForUser(req.auth!.userId);
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
