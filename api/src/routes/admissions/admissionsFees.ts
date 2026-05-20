import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { HttpError } from '../../middleware/error.js';
import {
  getFeeForApplicant,
  getFeeForApplication,
  recordApplicationPayment,
  toApplicationFeeDto,
  toApplicationPaymentDto,
  waiveApplicationFee,
} from '../../services/admissions/applicationFeeService.js';

const RecordPaymentBody = z.object({
  amountPaise: z.coerce.number().int().nonnegative(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']),
  reference: z.string().max(200).optional(),
  receivedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const WaiveBody = z.object({
  reason: z.string().min(1).max(2000),
});

/** Mounted at `/v1/admissions/me/fee` — applicant view of their own fee. */
export function meFeeRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('applicant'));

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fee = await getFeeForApplicant(req.auth!.userId);
        if (!fee) {
          // No fee row yet (e.g. before submit). Respond with a synthetic
          // "not-yet-required" shape so the UI doesn't have to special-case.
          res.status(200).json({ data: { fee: null } });
          return;
        }
        res.status(200).json({ data: { fee: toApplicationFeeDto(fee) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/**
 * Mounted at `/v1/admissions/finance` — admin records application payments.
 * (M10r: the dedicated `finance` role is gone; admin owns this surface now.
 * Route URL keeps the `/finance` segment for backward compatibility with any
 * external links / docs that already point here.)
 */
export function financeAdmissionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin'));

  router.get(
    '/applications/:id/fee',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fee = await getFeeForApplication(req.params.id ?? '');
        if (!fee) throw new HttpError(404, 'NOT_FOUND', 'Application fee not found.');
        res.status(200).json({ data: { fee: toApplicationFeeDto(fee) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/applications/:id/payment',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RecordPaymentBody.parse(req.body);
        const { fee, payment } = await recordApplicationPayment(
          req.params.id ?? '',
          req.auth!.userId,
          body,
        );
        res.status(201).json({
          data: {
            fee: toApplicationFeeDto(fee),
            payment: toApplicationPaymentDto(payment),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Officer-side fee waiver — bolted onto the existing /officer router. */
export function officerFeeRoutes(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admissions_officer', 'admin', 'superadmin'));

  router.get(
    '/applications/:id/fee',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fee = await getFeeForApplication(req.params.id ?? '');
        if (!fee) throw new HttpError(404, 'NOT_FOUND', 'Application fee not found.');
        res.status(200).json({ data: { fee: toApplicationFeeDto(fee) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/applications/:id/fee/waive',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = WaiveBody.parse(req.body);
        const fee = await waiveApplicationFee(
          req.params.id ?? '',
          req.auth!.userId,
          body.reason,
        );
        res.status(200).json({ data: { fee: toApplicationFeeDto(fee) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

