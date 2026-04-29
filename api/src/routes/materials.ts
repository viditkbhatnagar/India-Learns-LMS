import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createMaterialOnSession,
  deleteMaterial,
  getMaterialForStaff,
  replaceSlideBody,
  toMaterialDetailDto,
} from '../services/materialService.js';

const STAFF_ROLES = ['faculty', 'admin', 'superadmin'] as const;

const CreateMaterialBody = z.object({
  type: z.enum(['reading', 'pdf', 'video', 'link', 'practice', 'reflection', 'file', 'case']),
  title: z.string().min(1).max(400),
  url: z.string().url().max(2048).nullable().optional(),
  body: z.string().max(16_000).nullable().optional(),
  sizeBytes: z.number().int().positive().nullable().optional(),
  expectedHours: z.number().nonnegative().nullable().optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

/**
 * Mounted at /v1/sessions/:sessionId/materials — owner is the session,
 * so the route lives next to other session-scoped writes (attendance,
 * complete, uncomplete, update). Mounted from `routes/index.ts`.
 */
export function sessionMaterialsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CreateMaterialBody.parse(req.body);
      const material = await createMaterialOnSession(
        req.auth!,
        req.params.sessionId ?? '',
        body,
        requestContext(req),
      );
      res.status(201).json({ data: { material: toMaterialDetailDto(material) } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** Mounted at /v1/materials. */
export function materialsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await getMaterialForStaff(req.auth!, req.params.id ?? '');
      res.json({ data: { material: toMaterialDetailDto(material) } });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await deleteMaterial(
        req.auth!,
        req.params.id ?? '',
        requestContext(req),
      );
      res.status(200).json({ data: { material: toMaterialDetailDto(material) } });
    } catch (err) {
      next(err);
    }
  });

  // PR #16 Phase 2 — slide-deck replace + download.
  // Replace: PUT a JSON body of the new slides; bumps slideCount.
  // Download: returns the current `body` as `application/json`
  // attachment so faculty can save → edit → re-upload.
  router.put('/:id/slides', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await replaceSlideBody(
        req.auth!,
        req.params.id ?? '',
        req.body,
        requestContext(req),
      );
      res.status(200).json({ data: { material: toMaterialDetailDto(material) } });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const material = await getMaterialForStaff(req.auth!, req.params.id ?? '');
      if (material.type !== 'slides') {
        // For non-slides we just stream the URL string back; the operator
        // can follow it. Slide JSON is the only thing we own internally.
        res.status(200).json({ data: { material: toMaterialDetailDto(material) } });
        return;
      }
      const filename = `${material.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'slides'}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(JSON.stringify(material.body, null, 2));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
