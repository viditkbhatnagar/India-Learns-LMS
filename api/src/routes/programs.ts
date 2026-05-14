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

const DocReqEnum = z.enum(['govid', 'transcript', 'resume', 'portfolio', 'test_score', 'other']);

const UpdateBody = z.object({
  name: z.string().min(1).max(160).optional(),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).optional(),
  totalHours: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  // Admissions M5+ — admin can toggle and configure the funnel here.
  admissionsEnabled: z.boolean().optional(),
  admissionMode: z.enum(['cohort_pick', 'program_only']).optional(),
  applicationFeePaise: z.coerce.number().int().nonnegative().optional(),
  requiredDocs: z
    .array(
      z.object({
        documentType: DocReqEnum,
        label: z.string().min(1).max(200),
        required: z.boolean(),
      }),
    )
    .max(10)
    .optional(),
  requiresStatement: z.boolean().optional(),
  requiresReferences: z.boolean().optional(),
  referencesMinCount: z.coerce.number().int().min(0).max(5).optional(),
  referencesMaxCount: z.coerce.number().int().min(0).max(5).optional(),
  statementWordLimit: z.coerce.number().int().min(50).max(5000).optional(),
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
    requireRole('admin', 'superadmin'),
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
    requireRole('admin', 'superadmin'),
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
    requireRole('admin', 'superadmin'),
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
