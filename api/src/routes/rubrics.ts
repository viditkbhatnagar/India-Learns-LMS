import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createRubric,
  deleteRubric,
  getRubric,
  listRubrics,
  toRubricDto,
  updateRubric,
} from '../services/rubricService.js';

const CriterionInput = z.object({
  label: z.string().min(1).max(240),
  kind: z.enum(['numeric', 'scale']),
  maxScore: z.number().int().min(1).nullable().optional(),
  scale: z.array(z.string().max(200)).optional(),
});

const CreateRubricBody = z.object({
  courseId: z.string().min(1),
  name: z.string().min(1).max(240),
  criteria: z.array(CriterionInput).min(1),
  isTemplate: z.boolean().optional(),
});

const UpdateRubricBody = z.object({
  name: z.string().min(1).max(240).optional(),
  criteria: z.array(CriterionInput).min(1).optional(),
  isTemplate: z.boolean().optional(),
});

export function rubricsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const courseId = typeof req.query.courseId === 'string'
          ? req.query.courseId
          : undefined;
        const rubrics = await listRubrics(req.auth!, courseId);
        res.json({ data: { rubrics: rubrics.map(toRubricDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateRubricBody.parse(req.body);
        const rubric = await createRubric(
          req.auth!,
          {
            courseId: body.courseId,
            name: body.name,
            criteria: body.criteria.map((c) => ({
              label: c.label,
              kind: c.kind,
              maxScore: c.maxScore ?? null,
              scale: c.scale ?? [],
            })),
            isTemplate: body.isTemplate,
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.status(201).json({ data: { rubric: toRubricDto(rubric) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rubric = await getRubric(req.auth!, req.params.id ?? '');
        res.json({ data: { rubric: toRubricDto(rubric) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateRubricBody.parse(req.body);
        const rubric = await updateRubric(
          req.auth!,
          req.params.id ?? '',
          {
            name: body.name,
            criteria: body.criteria?.map((c) => ({
              label: c.label,
              kind: c.kind,
              maxScore: c.maxScore ?? null,
              scale: c.scale ?? [],
            })),
            isTemplate: body.isTemplate,
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { rubric: toRubricDto(rubric) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteRubric(req.auth!, req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
