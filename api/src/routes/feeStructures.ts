import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createFeeStructure,
  findFeeStructureById,
  listFeeStructures,
  toFeeStructureDto,
  updateFeeStructure,
} from '../services/feeStructureService.js';

const ComponentInput = z.object({
  kind: z.enum(['registration', 'tuition', 'exam', 'certification', 'misc']),
  label: z.string().min(1).max(120),
  amountPaise: z.number().int().min(0),
  cadence: z.enum(['one_time', 'monthly_x']),
  monthlyCount: z.number().int().min(1).max(36).nullable().optional(),
  dueRule: z.enum([
    'on_enrolment',
    'first_of_month',
    'exam_scheduled',
    'month_before_end',
    'manual',
  ]),
  weights: z.array(z.number().nonnegative()).nullable().optional(),
});

const CreateBody = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(160),
  components: z.array(ComponentInput).min(1),
  paymentTerms: z.string().max(2000).optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(160).optional(),
  components: z.array(ComponentInput).optional(),
  paymentTerms: z.string().max(2000).optional(),
});

function actorCtx(req: Request) {
  return {
    actorUserId: req.auth!.userId,
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function feeStructuresRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin', 'superadmin', 'finance'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const programId = (req.query.programId as string | undefined) ?? undefined;
        const docs = await listFeeStructures({ programId });
        res.status(200).json({ data: { items: docs.map(toFeeStructureDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const normalised = {
          ...body,
          components: body.components.map((c) => ({
            kind: c.kind,
            label: c.label,
            amountPaise: c.amountPaise,
            cadence: c.cadence,
            monthlyCount: c.monthlyCount ?? null,
            dueRule: c.dueRule,
            weights: c.weights ?? null,
          })),
        };
        const doc = await createFeeStructure(normalised, actorCtx(req));
        res.status(201).json({ data: { feeStructure: toFeeStructureDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireRole('admin', 'superadmin', 'finance'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findFeeStructureById(req.params.id ?? '');
        res.status(200).json({ data: { feeStructure: toFeeStructureDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const normalised = {
          ...body,
          components: body.components
            ? body.components.map((c) => ({
                kind: c.kind,
                label: c.label,
                amountPaise: c.amountPaise,
                cadence: c.cadence,
                monthlyCount: c.monthlyCount ?? null,
                dueRule: c.dueRule,
                weights: c.weights ?? null,
              }))
            : undefined,
        };
        const doc = await updateFeeStructure(
          req.params.id ?? '',
          normalised,
          actorCtx(req),
        );
        res.status(200).json({ data: { feeStructure: toFeeStructureDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
