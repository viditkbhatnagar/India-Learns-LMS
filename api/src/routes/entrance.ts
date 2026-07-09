import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireEntranceCandidate } from '../middleware/entranceAuth.js';
import { buildEntranceLoginLimiter } from '../middleware/rateLimit.js';
import {
  getCandidateState,
  loginCandidate,
  saveAnswers,
  startAttempt,
  submitAttempt,
} from '../services/entrance/entranceService.js';
import {
  getAttemptAdmin,
  getCandidateDetail,
  getExamAdmin,
  gradeTextAnswer,
  listCandidates,
  listExams,
  updateExam,
} from '../services/entrance/entranceAdminService.js';

function ctx(req: Request): { ip: string; ua: string } {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

const LoginBody = z.object({
  phone: z.string().min(3).max(20),
  password: z.string().min(1).max(256),
});

const AnswerInput = z.object({
  questionIndex: z.number().int().min(0).max(999),
  selectedIndex: z.number().int().min(0).max(999).nullable().optional(),
  textAnswer: z.string().max(40_000).optional(),
});

const SaveBody = z.object({
  answers: z.array(AnswerInput).max(500),
});

const SubmitBody = z
  .object({
    answers: z.array(AnswerInput).max(500).optional(),
    auto: z.boolean().optional(),
  })
  .default({});

const UpdateExamBody = z.object({
  state: z.enum(['draft', 'live', 'closed']).optional(),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
});

const GradeBody = z.object({
  questionIndex: z.number().int().min(0).max(999),
  marks: z.number().min(0).max(1000),
  comment: z.string().max(4000).optional(),
});

/** Public — candidate login by phone + password. No auth. */
export function entrancePublicRouter(): Router {
  const router = Router();

  router.post(
    '/login',
    buildEntranceLoginLimiter(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = LoginBody.parse(req.body);
        const result = await loginCandidate(body.phone, body.password, ctx(req));
        res.status(200).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Candidate-facing — gated by the entrance token. Mounted at /entrance/me. */
export function entranceCandidateRouter(): Router {
  const router = Router();
  router.use(requireEntranceCandidate);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await getCandidateState(String(req.entranceAuth!.candidateId));
      res.status(200).json({ data: state });
    } catch (err) {
      next(err);
    }
  });

  router.post('/attempt', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attempt = await startAttempt(String(req.entranceAuth!.candidateId), ctx(req));
      res.status(201).json({ data: { attempt } });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/attempt', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SaveBody.parse(req.body);
      const attempt = await saveAnswers(
        String(req.entranceAuth!.candidateId),
        body.answers,
      );
      res.status(200).json({ data: { attempt } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/attempt/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SubmitBody.parse(req.body ?? {});
      const attempt = await submitAttempt(
        String(req.entranceAuth!.candidateId),
        body.answers,
        { ...ctx(req), auto: body.auto },
      );
      res.status(200).json({ data: { attempt } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** Admin/teacher — normal staff auth. Mounted at /entrance/admin. */
export function entranceAdminRouter(): Router {
  const router = Router();
  router.use(requireAuth, requireRole('admin', 'superadmin', 'faculty'));

  router.get('/exams', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: { exams: await listExams() } });
    } catch (err) {
      next(err);
    }
  });

  router.get('/exams/:examId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(200).json({ data: { exam: await getExamAdmin(req.params.examId ?? '') } });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/exams/:examId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateExamBody.parse(req.body);
      const exam = await updateExam(req.params.examId ?? '', body, {
        actorUserId: req.auth!.userId,
        ...ctx(req),
      });
      res.status(200).json({ data: { exam } });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/exams/:examId/candidates',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const candidates = await listCandidates(req.params.examId ?? '');
        res.status(200).json({ data: { candidates } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/candidates/:candidateId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const detail = await getCandidateDetail(req.params.candidateId ?? '');
        res.status(200).json({ data: detail });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get('/attempts/:attemptId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attempt = await getAttemptAdmin(req.params.attemptId ?? '');
      res.status(200).json({ data: { attempt } });
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    '/attempts/:attemptId/grade',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = GradeBody.parse(req.body);
        const attempt = await gradeTextAnswer(req.params.attemptId ?? '', body, {
          actorUserId: req.auth!.userId,
          ...ctx(req),
        });
        res.status(200).json({ data: { attempt } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
