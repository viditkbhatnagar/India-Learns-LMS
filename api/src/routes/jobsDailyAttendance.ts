import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runDailyAttendanceReportJob } from '../jobs/dailyAttendanceReportJob.js';

// M10 — Daily attendance auto-report (LMS_Requirements §2 + §5).
// HMAC-signed endpoint; scheduled by Render cron (see render.yaml) at
// 13:00 UTC daily. Same shape as the other job routers in this codebase
// — empty body, requireJobAuth gates the HMAC, handler returns the
// service result for the audit + Render logs.
export function jobsDailyAttendanceRouter(): Router {
  const router = Router();

  router.post(
    '/daily-attendance-report',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runDailyAttendanceReportJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
