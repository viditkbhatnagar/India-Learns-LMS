import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getAnalyticsSummary,
  getCollectionsReport,
  getSlaBreachReport,
} from '../services/analyticsService.js';

const SummaryQuery = z.object({
  programId: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const CollectionsQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const SlaQuery = z.object({
  week: z.string().regex(/^\d{4}-W\d{1,2}$/),
});

// M8 — Admin analytics routes (TRD §5.12, PRD §15).
// All endpoints are admin/superadmin only. Finance + faculty access scoped
// subsets is M9 polish — for M8 they get 403 at the gate.
export function analyticsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin'));

  router.get(
    '/summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = SummaryQuery.parse(req.query);
        if ((q.from && !q.to) || (!q.from && q.to)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_FAILED',
              message: '`from` and `to` must be supplied together.',
            },
          });
          return;
        }
        const data = await getAnalyticsSummary({
          programId: q.programId,
          from: q.from ? new Date(q.from) : undefined,
          to: q.to ? new Date(q.to) : undefined,
        });
        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/collections',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = CollectionsQuery.parse(req.query);
        const report = await getCollectionsReport({
          from: new Date(q.from),
          to: new Date(q.to),
        });
        res.status(200).json({ data: report });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/sla-breaches',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = SlaQuery.parse(req.query);
        const report = await getSlaBreachReport(q.week);
        res.status(200).json({ data: report });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
