import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  createProgram,
  deleteProgram,
  findProgramById,
  listPrograms,
  toProgramDto,
  updateProgram,
} from '../services/programService.js';

const CreateBody = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
  totalHours: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(160).optional(),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  totalHours: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const ListQuery = z.object({
  q: z.string().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function programsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListQuery.parse(req.query);
        const result = await listPrograms(query);
        res.status(200).json({
          data: {
            items: result.items.map(toProgramDto),
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
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createProgram(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { program: toProgramDto(doc) } });
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
        const doc = await findProgramById(req.params.id ?? '');
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
        res.status(200).json({ data: { program: toProgramDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateProgram(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { program: toProgramDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteProgram(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { program: toProgramDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
