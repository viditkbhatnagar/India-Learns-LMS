import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runFacultyDigestJob } from '../jobs/facultyDigestJob.js';

export function jobsFacultyDigestRouter(): Router {
  const router = Router();

  router.post(
    '/digest-faculty-weekly',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runFacultyDigestJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
