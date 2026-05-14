import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  createBatch,
  deleteBatch,
  findBatchById,
  listBatches,
  toBatchDto,
  updateBatch,
} from '../services/batchService.js';

const BatchStatusEnum = z.enum(['planned', 'active', 'completed', 'archived']);

const CreateBody = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(160),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  capacity: z.coerce.number().int().positive().optional(),
  status: BatchStatusEnum.optional(),
  coordinators: z.array(z.string()).max(20).optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(160).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  status: BatchStatusEnum.optional(),
  coordinators: z.array(z.string()).max(20).optional(),
  // Admissions M5+ — toggle visibility on the public /apply cohort feed +
  // manual seat-count override (auto-decrement at admit time is separate).
  openForApplications: z.boolean().optional(),
  seatsRemaining: z.coerce.number().int().nonnegative().optional(),
});

const ListQuery = z.object({
  programId: z.string().optional(),
  status: BatchStatusEnum.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function batchesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListQuery.parse(req.query);
        const result = await listBatches(query);
        res.status(200).json({
          data: {
            items: result.items.map(toBatchDto),
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        });
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
        const doc = await createBatch(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { batch: toBatchDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findBatchById(req.params.id ?? '');
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
        res.status(200).json({ data: { batch: toBatchDto(doc) } });
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
        const doc = await updateBatch(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { batch: toBatchDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteBatch(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { batch: toBatchDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
