import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  applyCreditNote,
  toCreditNoteDto,
} from '../services/paymentService.js';

// Q-M5-02 — Apply an outstanding credit note to a specific installment.
//
// POST /v1/credit-notes/:id/apply
// Body: { installmentId, amountPaise? }
//
// `amountPaise` is optional — defaults to min(creditNote.balancePaise,
// installment.openPaise). Caller passes an explicit smaller value when
// splitting a single CN across multiple installments.

const ApplyBody = z.object({
  installmentId: z.string().min(1),
  amountPaise: z.number().int().positive().optional(),
});

export function creditNotesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/:id/apply',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ApplyBody.parse(req.body);
        const result = await applyCreditNote(req.params.id ?? '', body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(200).json({
          data: {
            creditNote: toCreditNoteDto(result.creditNote),
            appliedPaise: result.appliedPaise,
            installmentId: result.installmentId.toString(),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
