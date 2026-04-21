import { Types } from 'mongoose';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  issueForEnrollment,
  listCertificatesForStudent,
} from '../services/certificateService.js';

// M8 — Certificate routes (TRD §5.10, PRD §13).
//
//   POST /v1/enrollments/:id/issue-certificate   — admin retry button
//   GET  /v1/me/certificates                      — student list
//
// The admin trigger is idempotent: re-posting returns the existing URL with
// `reissued: true`. Listener-driven auto-issue fires on `course.completed`
// (registered in api/src/index.ts + wired in certificateService).

export function meCertificatesRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listCertificatesForStudent(
        new Types.ObjectId(req.auth!.userId),
      );
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function enrollmentCertificateAdminRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin'));

  router.post(
    '/:id/issue-certificate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await issueForEnrollment({
          enrollmentId: req.params.id ?? '',
          actor: 'admin',
          actorUserId: req.auth!.user._id,
        });
        res.status(result.reissued ? 200 : 201).json({
          data: { certificate: result.certificate, reissued: result.reissued },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
