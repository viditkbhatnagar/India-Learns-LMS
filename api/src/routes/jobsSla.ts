import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runTicketSlaJob } from '../jobs/ticketSlaJob.js';

export function jobsSlaRouter(): Router {
  const router = Router();

  router.post(
    '/sla-timers',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runTicketSlaJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
