import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { Receipt } from '../models/index.js';
import { ConsoleStorageAdapter } from '../integrations/storageAdapter.js';
import { getSignedReceiptUrl, toReceiptDto } from '../services/receiptService.js';

export function receiptsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:id/download',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id ?? '';
        if (!Types.ObjectId.isValid(id)) {
          throw new HttpError(404, 'NOT_FOUND', 'Receipt not found.');
        }
        const receipt = await Receipt.findById(id);
        if (!receipt) {
          throw new HttpError(404, 'NOT_FOUND', 'Receipt not found.');
        }
        const { role, userId } = req.auth!;
        const isSelf = receipt.studentId.equals(userId);
        const canView = isSelf || role === 'admin' || role === 'superadmin';
        if (!canView) {
          throw new HttpError(403, 'FORBIDDEN', 'Access denied.');
        }

        // In stub mode we hold the bytes in-process; stream them directly so
        // the DoD curl works end-to-end without a live Cloudinary account.
        if (receipt.pdfKey.startsWith('stub:')) {
          const bytes = ConsoleStorageAdapter.getCached(receipt.pdfKey);
          if (bytes) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${receipt.code}.pdf"`,
            );
            res.status(200).send(Buffer.from(bytes));
            return;
          }
        }
        const url = await getSignedReceiptUrl(receipt, 3600);
        res.status(200).json({
          data: { receipt: toReceiptDto(receipt), signedUrl: url, ttlSec: 3600 },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
