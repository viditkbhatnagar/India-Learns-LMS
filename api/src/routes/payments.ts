import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  recordPayment,
  reversePayment,
  toCreditNoteDto,
  toPaymentDto,
} from '../services/paymentService.js';
import { toReceiptDto } from '../services/receiptService.js';

const AllocationInput = z.object({
  installmentId: z.string().min(1),
  amountPaise: z.number().int().positive(),
});

const RecordPaymentBody = z.object({
  studentId: z.string().min(1),
  amountPaise: z.number().int().positive(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  reference: z.string().max(200).optional(),
  receivedAt: z.string().datetime().optional(),
  allocations: z.array(AllocationInput).optional(),
  notes: z.string().max(1000).optional(),
});

const ReverseBody = z.object({
  reason: z.string().min(1).max(500),
});

export function paymentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/',
    requireRole('finance', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RecordPaymentBody.parse(req.body);
        const result = await recordPayment(body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({
          data: {
            payment: toPaymentDto(result.payment),
            receipt: toReceiptDto(result.receipt),
            creditNote: result.creditNote
              ? toCreditNoteDto(result.creditNote)
              : null,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/reverse',
    requireRole('finance', 'admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ReverseBody.parse(req.body);
        const result = await reversePayment(req.params.id ?? '', body.reason, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(200).json({
          data: {
            payment: toPaymentDto(result.payment),
            creditNote: toCreditNoteDto(result.creditNote),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
