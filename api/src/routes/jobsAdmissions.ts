import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runRefereeReminderJob } from '../jobs/refereeReminderJob.js';

export function jobsAdmissionsRouter(): Router {
  const router = Router();

  // M3b — daily referee reminder + token expiration sweep.
  router.post(
    '/admissions-referee-reminders',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runRefereeReminderJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
