import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runFeeRemindersJob } from '../jobs/feeRemindersJob.js';
import { runAutoSuspendJob } from '../jobs/autoSuspendJob.js';

export function jobsFeesRouter(): Router {
  const router = Router();

  router.post(
    '/fee-reminders',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runFeeRemindersJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/autosuspend',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runAutoSuspendJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
