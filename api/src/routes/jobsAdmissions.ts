import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireJobAuth } from '../middleware/requireJobAuth.js';
import { runRefereeReminderJob } from '../jobs/refereeReminderJob.js';
import { runAdmissionsAuditHeadSnapshotJob } from '../jobs/admissionsAuditHeadSnapshotJob.js';
import { runAdmissionsDraftCleanupJob } from '../jobs/admissionsDraftCleanupJob.js';

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

  // M9 — daily audit chain head-hash snapshot.
  router.post(
    '/admissions-audit-head-snapshot',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runAdmissionsAuditHeadSnapshotJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // M9 — daily orphan-draft cleanup (storage GC + draft / application drop).
  router.post(
    '/admissions-draft-cleanup',
    requireJobAuth,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await runAdmissionsDraftCleanupJob();
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
