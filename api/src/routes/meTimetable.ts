import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { Enrollment, TimetableEntry } from '../models/index.js';
import { resolveWindow } from '../services/timetableResolutionService.js';
import { parseIsoWeek } from '../services/timetableTz.js';

const Query = z
  .object({
    week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine(
    (q) => Boolean(q.week) || (q.from && q.to),
    { message: 'Provide either `week=YYYY-Www` or both `from` and `to`.' },
  );

/**
 * `/v1/me/timetable` — student or faculty view of their own schedule.
 */
export function meTimetableRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student', 'faculty'));

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = Query.parse(req.query);
        let fromIst: string;
        let toIst: string;
        if (q.week) {
          const parsed = parseIsoWeek(q.week);
          fromIst = parsed.fromIst;
          toIst = parsed.toIst;
        } else {
          fromIst = q.from!;
          toIst = q.to!;
        }

        let batchIds: Types.ObjectId[];
        if (req.auth!.role === 'student') {
          const active = await Enrollment.find({
            studentId: req.auth!.userId,
            status: 'active',
          }).select('batchId');
          batchIds = Array.from(
            new Set(active.map((e) => e.batchId.toString())),
          ).map((id) => new Types.ObjectId(id));
        } else {
          // Faculty: derive the set of batches from their assigned
          // timetable entries so M4 doesn't require a Course→Batch join.
          const entries = await TimetableEntry.find({
            facultyId: req.auth!.userId,
            deletedAt: null,
          }).select('batchId');
          batchIds = Array.from(
            new Set(entries.map((e) => e.batchId.toString())),
          ).map((id) => new Types.ObjectId(id));
        }

        if (batchIds.length === 0) {
          res.status(200).json({ data: { window: { from: fromIst, to: toIst }, occurrences: [] } });
          return;
        }

        const all = (
          await Promise.all(
            batchIds.map((batchId) =>
              resolveWindow({ batchId, fromIstYmd: fromIst, toIstYmd: toIst }),
            ),
          )
        ).flat();

        const scoped =
          req.auth!.role === 'faculty'
            ? all.filter((o) => o.facultyId === req.auth!.userId.toString())
            : all;

        scoped.sort((a, b) => (a.startAt < b.startAt ? -1 : 1));
        res.status(200).json({
          data: {
            window: { from: fromIst, to: toIst },
            occurrences: scoped,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
