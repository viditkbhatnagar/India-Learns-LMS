import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requestUploadTicket } from '../services/storageService.js';

const UploadBody = z.object({
  folder: z.enum(['course-pdfs', 'course-videos', 'receipts', 'avatars', 'ticket-attachments']),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
  courseId: z.string().optional(),
});

export function storageRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  // Storage service-layer (requestUploadTicket) already enforces the
  // admin/superadmin/faculty rule; the gate here is the coarse filter.
  router.use(requireRole('admin', 'superadmin', 'faculty'));

  router.post(
    '/upload-url',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UploadBody.parse(req.body);
        const ticket = await requestUploadTicket(body, {
          role: req.auth!.role,
          userId: req.auth!.userId,
        });
        res.status(200).json({ data: { ticket } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
