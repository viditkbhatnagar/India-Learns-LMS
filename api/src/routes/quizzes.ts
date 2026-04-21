import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createQuiz,
  getQuizForStaff,
  getQuizForStudent,
  listAttemptsForStudent,
  startAttempt,
  submitAttempt,
  toQuizAttemptDto,
  toQuizDto,
  toStudentQuizDto,
  updateQuiz,
} from '../services/quizService.js';

const QuestionInput = z.object({
  text: z.string().min(1).max(4000),
  kind: z.enum(['mcq_single', 'mcq_multi']),
  options: z.array(z.string().max(1000)).min(2),
  correctIndices: z.array(z.number().int().min(0)).min(1),
  points: z.number().min(0),
});

const CreateQuizBody = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1).max(240),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  passingPercent: z.number().min(0).max(100).optional(),
  questions: z.array(QuestionInput).min(1),
  openAt: z.string().datetime().nullable().optional(),
  closeAt: z.string().datetime().nullable().optional(),
});

const UpdateQuizBody = z.object({
  title: z.string().min(1).max(240).optional(),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  passingPercent: z.number().min(0).max(100).optional(),
  questions: z.array(QuestionInput).min(1).optional(),
  state: z.enum(['draft', 'scheduled', 'live', 'closed']).optional(),
  openAt: z.string().datetime().nullable().optional(),
  closeAt: z.string().datetime().nullable().optional(),
});

const SubmitBody = z.object({
  answers: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0),
        chosenIndices: z.array(z.number().int().min(0)).default([]),
      }),
    )
    .default([]),
});

export function quizzesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateQuizBody.parse(req.body);
        const quiz = await createQuiz(req.auth!, body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { quiz: toQuizDto(quiz) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { auth } = req;
        if (!auth) throw new Error('auth missing'); // guard for TS; requireAuth enforces
        if (auth.role === 'student') {
          const quiz = await getQuizForStudent(auth, req.params.id ?? '');
          const attempts = await listAttemptsForStudent(auth, req.params.id ?? '');
          res.json({
            data: {
              quiz: toStudentQuizDto(quiz),
              attempts: attempts.map(toQuizAttemptDto),
            },
          });
          return;
        }
        const quiz = await getQuizForStaff(auth, req.params.id ?? '');
        res.json({ data: { quiz: toQuizDto(quiz) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateQuizBody.parse(req.body);
        const quiz = await updateQuiz(req.auth!, req.params.id ?? '', body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.json({ data: { quiz: toQuizDto(quiz) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/attempt',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const attempt = await startAttempt(req.auth!, req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { attempt: toQuizAttemptDto(attempt) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function quizAttemptsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/:id/submit',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SubmitBody.parse(req.body);
        const attempt = await submitAttempt(
          req.auth!,
          req.params.id ?? '',
          body,
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { attempt: toQuizAttemptDto(attempt) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
