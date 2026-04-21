import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { applyOverride, revokeOverride } from '../services/suspensionService.js';
import { toUserDto } from '../services/userService.js';

const ApplyBody = z.object({
  until: z.string().datetime(),
  reason: z.string().min(1).max(500),
});

export function suspensionOverrideRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/:id/suspension/override',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ApplyBody.parse(req.body);
        const user = await applyOverride(req.params.id ?? '', body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(200).json({ data: { user: toUserDto(user) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id/suspension/override',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await revokeOverride(req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(200).json({ data: { user: toUserDto(user) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
