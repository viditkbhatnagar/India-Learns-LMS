import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { buildStudentFees } from '../services/studentFeesService.js';

function resolveStudentId(req: Request, paramName: string): string {
  const raw = req.params[paramName];
  if (raw === 'me') {
    return String(req.auth!.userId);
  }
  return raw ?? '';
}

function assertCanView(req: Request, targetId: string): void {
  const { role, userId } = req.auth!;
  if (role === 'admin' || role === 'finance' || role === 'superadmin') return;
  if (Types.ObjectId.isValid(targetId) && userId.equals(new Types.ObjectId(targetId))) {
    return;
  }
  throw new HttpError(403, 'FORBIDDEN', 'Access denied.');
}

export function studentFeesRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  // Defensive role gate added with the M1 admissions cut-over: applicants
  // (and admissions_officers) must not be able to probe a student's fees by
  // calling /students/me/fees. The assertCanView() body below already does an
  // identity check, but explicit role gating keeps the surface readable.
  router.use(requireRole('student', 'admin', 'finance', 'superadmin'));

  router.get(
    '/:id/fees',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = resolveStudentId(req, 'id');
        assertCanView(req, id);
        const dto = await buildStudentFees(id);
        res.status(200).json({ data: { fees: dto } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mount at `/v1/students/me` — convenience alias that skips the :id param. */
export function myFeesRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student', 'admin', 'finance', 'superadmin'));
  router.get(
    '/fees',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dto = await buildStudentFees(String(req.auth!.userId));
        res.status(200).json({ data: { fees: dto } });
      } catch (err) {
        next(err);
      }
    },
  );
  return router;
}
