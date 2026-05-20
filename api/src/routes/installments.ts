import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createInstallment,
  patchInstallment,
  waiveInstallment,
} from '../services/installmentService.js';

const PatchBody = z.object({
  label: z.string().min(1).max(160).optional(),
  amountPaise: z.coerce.number().int().nonnegative().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['pending', 'partial', 'paid', 'overdue', 'waived']).optional(),
});

const CreateBody = z.object({
  invoiceId: z.string(),
  label: z.string().min(1).max(160),
  amountPaise: z.coerce.number().int().nonnegative(),
  dueDate: z.string(),
  status: z.enum(['pending', 'partial', 'paid', 'overdue', 'waived']).optional(),
});

function actorCtx(req: Request) {
  return {
    role: req.auth!.role,
    actorUserId: req.auth!.userId,
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function installmentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin'));

  // POST /v1/installments — add a new installment row to an invoice.
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const { installment, invoice } = await createInstallment(body, actorCtx(req));
        res.status(201).json({
          data: {
            installment: installment.toJSON(),
            invoice: invoice.toJSON(),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // PATCH /v1/installments/:id — edit label / amount / due-date / status.
  router.patch(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = PatchBody.parse(req.body);
        const { installment, invoice } = await patchInstallment(
          req.params.id ?? '',
          body,
          actorCtx(req),
        );
        res.status(200).json({
          data: {
            installment: installment.toJSON(),
            invoice: invoice.toJSON(),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /v1/installments/:id/waive — shorthand for status='waived'.
  router.post(
    '/:id/waive',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { installment, invoice } = await waiveInstallment(
          req.params.id ?? '',
          actorCtx(req),
        );
        res.status(200).json({
          data: {
            installment: installment.toJSON(),
            invoice: invoice.toJSON(),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
