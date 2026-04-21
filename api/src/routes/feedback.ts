import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createFeedback,
  getFeedback,
  listFeedback,
  listForStudent,
  publishFeedback,
  toFeedbackEntryDto,
  updateFeedback,
} from '../services/feedbackService.js';

const ScoreInput = z.object({
  criterionIndex: z.number().int().min(0),
  score: z.number().min(0).nullable().optional(),
  label: z.string().max(200).nullable().optional(),
});

const CreateFeedbackBody = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  moduleId: z.string().min(1).nullable().optional(),
  level: z.enum(['assignment', 'module', 'assessment']),
  assessmentRef: z.string().min(1).nullable().optional(),
  rubricId: z.string().min(1).nullable().optional(),
  scores: z.array(ScoreInput).optional(),
  comments: z.string().max(16_000).optional(),
  summary: z.string().min(1).max(1000),
  status: z.enum(['draft', 'published']).optional(),
});

const UpdateFeedbackBody = z.object({
  moduleId: z.string().min(1).nullable().optional(),
  level: z.enum(['assignment', 'module', 'assessment']).optional(),
  assessmentRef: z.string().min(1).nullable().optional(),
  rubricId: z.string().min(1).nullable().optional(),
  scores: z.array(ScoreInput).optional(),
  comments: z.string().max(16_000).optional(),
  summary: z.string().min(1).max(1000).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

const ListQuery = z.object({
  studentId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  moduleId: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
  level: z.enum(['assignment', 'module', 'assessment']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 500),
      { message: 'limit must be 1..500' },
    ),
});

export function feedbackRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = ListQuery.parse(req.query);
        const entries = await listFeedback(req.auth!, parsed);
        res.json({ data: { feedback: entries.map(toFeedbackEntryDto) } });
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
        const body = CreateFeedbackBody.parse(req.body);
        const entry = await createFeedback(
          req.auth!,
          {
            ...body,
            scores: body.scores?.map((s) => ({
              criterionIndex: s.criterionIndex,
              score: s.score ?? null,
              label: s.label ?? null,
            })),
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.status(201).json({ data: { feedback: toFeedbackEntryDto(entry) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireRole('student', 'faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const entry = await getFeedback(req.auth!, req.params.id ?? '');
        res.json({ data: { feedback: toFeedbackEntryDto(entry) } });
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
        const body = UpdateFeedbackBody.parse(req.body);
        const entry = await updateFeedback(
          req.auth!,
          req.params.id ?? '',
          {
            ...body,
            scores: body.scores?.map((s) => ({
              criterionIndex: s.criterionIndex,
              score: s.score ?? null,
              label: s.label ?? null,
            })),
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { feedback: toFeedbackEntryDto(entry) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/publish',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const entry = await publishFeedback(req.auth!, req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.json({ data: { feedback: toFeedbackEntryDto(entry) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function meFeedbackRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limitRaw = typeof req.query.limit === 'string'
          ? Number(req.query.limit)
          : 100;
        const limit = Number.isFinite(limitRaw) ? limitRaw : 100;
        const entries = await listForStudent(req.auth!.userId, limit);
        res.json({ data: { feedback: entries.map(toFeedbackEntryDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
