import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createExam,
  getExamForStaff,
  getExamForStudent,
  listAttemptsForStudentExam,
  startExamAttempt,
  submitExamAttempt,
  toExamAttemptDto,
  toExamDto,
  toStudentExamDto,
  updateExam,
} from '../services/examService.js';
import {
  gradeExamAttempt,
  listGradingQueueForFaculty,
} from '../services/gradingService.js';

const ExamQuestionInput = z.object({
  text: z.string().min(1).max(8000),
  kind: z.enum(['mcq_single', 'mcq_multi', 'essay']),
  options: z.array(z.string().max(1000)).default([]),
  correctIndices: z.array(z.number().int().min(0)).default([]),
  points: z.number().min(0),
  rubricId: z.string().min(1).nullable().optional(),
  wordLimit: z.number().int().min(1).nullable().optional(),
});

const CreateExamBody = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(240),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  passingPercent: z.number().min(0).max(100).optional(),
  questions: z.array(ExamQuestionInput).min(1),
  openAt: z.string().datetime().nullable().optional(),
  closeAt: z.string().datetime().nullable().optional(),
});

const UpdateExamBody = z.object({
  title: z.string().min(1).max(240).optional(),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  maxAttempts: z.number().int().min(1).optional(),
  passingPercent: z.number().min(0).max(100).optional(),
  questions: z.array(ExamQuestionInput).min(1).optional(),
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
  essayAnswers: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0),
        text: z.string().max(40_000),
      }),
    )
    .default([]),
});

const GradeBody = z.object({
  grades: z
    .array(
      z.object({
        questionIndex: z.number().int().min(0),
        score: z.number().min(0),
        comment: z.string().max(4000).default(''),
        rubricScores: z
          .array(
            z.object({
              criterionIndex: z.number().int().min(0),
              score: z.number().min(0).nullable().optional(),
              label: z.string().max(200).nullable().optional(),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
});

const QueueQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 200),
      { message: 'limit must be 1..200' },
    ),
});

export function examsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateExamBody.parse(req.body);
        const exam = await createExam(
          req.auth!,
          {
            ...body,
            questions: body.questions.map((q) => ({
              text: q.text,
              kind: q.kind,
              options: q.options,
              correctIndices: q.correctIndices,
              points: q.points,
              rubricId: q.rubricId ?? null,
              wordLimit: q.wordLimit ?? null,
            })),
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.status(201).json({ data: { exam: toExamDto(exam) } });
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
        if (!auth) throw new Error('auth missing');
        if (auth.role === 'student') {
          const exam = await getExamForStudent(auth, req.params.id ?? '');
          const attempts = await listAttemptsForStudentExam(auth, req.params.id ?? '');
          res.json({
            data: {
              exam: toStudentExamDto(exam),
              attempts: attempts.map(toExamAttemptDto),
            },
          });
          return;
        }
        const exam = await getExamForStaff(auth, req.params.id ?? '');
        res.json({ data: { exam: toExamDto(exam) } });
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
        const body = UpdateExamBody.parse(req.body);
        const exam = await updateExam(
          req.auth!,
          req.params.id ?? '',
          {
            ...body,
            questions: body.questions?.map((q) => ({
              text: q.text,
              kind: q.kind,
              options: q.options,
              correctIndices: q.correctIndices,
              points: q.points,
              rubricId: q.rubricId ?? null,
              wordLimit: q.wordLimit ?? null,
            })),
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { exam: toExamDto(exam) } });
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
        const attempt = await startExamAttempt(req.auth!, req.params.id ?? '', {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { attempt: toExamAttemptDto(attempt) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function examAttemptsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Grading queue — must mount before /:id/* routes so the literal segment wins.
  router.get(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = QueueQuerySchema.parse(req.query);
        const attempts = await listGradingQueueForFaculty(req.auth!, parsed);
        res.json({ data: { attempts: attempts.map(toExamAttemptDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/submit',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SubmitBody.parse(req.body);
        const attempt = await submitExamAttempt(
          req.auth!,
          req.params.id ?? '',
          body,
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { attempt: toExamAttemptDto(attempt) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id/grade',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = GradeBody.parse(req.body);
        const attempt = await gradeExamAttempt(
          req.auth!,
          req.params.id ?? '',
          {
            grades: body.grades.map((g) => ({
              questionIndex: g.questionIndex,
              score: g.score,
              comment: g.comment,
              rubricScores: g.rubricScores?.map((r) => ({
                criterionIndex: r.criterionIndex,
                score: r.score ?? null,
                label: r.label ?? null,
              })),
            })),
          },
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { attempt: toExamAttemptDto(attempt) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
