import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  checkGeneratorHealth,
  listAvailableWorkflows,
  previewImport,
  runImport,
} from '../services/curriculumImport/index.js';

const PreviewQuery = z.object({
  workflowId: z.string().min(1),
});

const RunBody = z.object({
  workflowId: z.string().min(1),
  programId: z.string().min(1),
  replace: z.boolean().optional(),
});

export function curriculumImportRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  // Phase A is super-admin only — the gate doubles as a feature flag.
  router.use(requireRole('superadmin'));

  router.get(
    '/health',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await checkGeneratorHealth();
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workflows',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listAvailableWorkflows(req.auth!);
        res.json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/preview',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { workflowId } = PreviewQuery.parse(req.query);
        const preview = await previewImport(req.auth!, workflowId);
        res.json({ data: preview });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RunBody.parse(req.body);
        const result = await runImport(req.auth!, body, {
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({
          data: {
            workflowId: result.workflowId,
            courseId: String(result.courseId),
            created: result.created,
            warnings: result.warnings,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
