import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  generateForEnrollment,
  toInstallmentDto,
  toInvoiceDto,
} from '../services/invoiceGenerationService.js';

export function generateFeesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/:id/generate-fees',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await generateForEnrollment(req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(200).json({
          data: {
            invoices: result.invoices.map(toInvoiceDto),
            installments: result.installments.map(toInstallmentDto),
            createdCount: result.createdCount,
            skippedCount: result.skippedCount,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
