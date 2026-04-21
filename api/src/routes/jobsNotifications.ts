import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runNotificationsRetryJob } from '../jobs/notificationsRetryJob.js';

export function jobsNotificationsRouter(): Router {
  const router = Router();

  router.post(
    '/notifications-retry',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runNotificationsRetryJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
