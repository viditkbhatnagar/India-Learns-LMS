import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { Enrollment } from '../models/index.js';
import { resolveWindow } from '../services/timetableResolutionService.js';

const Query = z.object({
  batchId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Flat `/v1/timetable?batchId=&from=&to=` endpoint per M4 prompt §3.
 * Scoped per D-036 to coexist with `/v1/batches/:id/timetable` (entry list)
 * and `/v1/me/timetable` (week-or-range).
 */
export function timetableRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin', 'superadmin', 'faculty', 'student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = Query.parse(req.query);
        if (!Types.ObjectId.isValid(q.batchId)) {
          throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
        }
        const batchId = new Types.ObjectId(q.batchId);

        // Students may only resolve their own batch.
        if (req.auth!.role === 'student') {
          const hasActive = await Enrollment.exists({
            studentId: req.auth!.userId,
            batchId,
            status: 'active',
          });
          if (!hasActive) {
            throw new HttpError(403, 'FORBIDDEN', 'Not enrolled in this batch.');
          }
        }

        const occurrences = await resolveWindow({
          batchId,
          fromIstYmd: q.from,
          toIstYmd: q.to,
        });

        const scoped =
          req.auth!.role === 'faculty'
            ? occurrences.filter(
              (o) => o.facultyId === req.auth!.userId.toString(),
            )
            : occurrences;

        res.status(200).json({ data: { occurrences: scoped } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
