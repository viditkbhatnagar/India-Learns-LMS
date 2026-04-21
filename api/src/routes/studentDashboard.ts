import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { buildStudentDashboard } from '../services/studentDashboardService.js';

export function studentDashboardRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get(
    '/dashboard',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payload = await buildStudentDashboard(req.auth!.user);
        res.status(200).json({ data: payload });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
