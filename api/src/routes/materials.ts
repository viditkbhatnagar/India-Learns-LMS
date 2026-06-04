import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { buildPptxImportLimiter } from '../middleware/rateLimit.js';
import {
  createMaterialOnSession,
  deleteMaterial,
  getMaterialForStaff,
  importPptxSlides,
  replaceSlideBody,
  toMaterialDetailDto,
} from '../services/materialService.js';

const STAFF_ROLES = ['faculty', 'admin', 'superadmin'] as const;

// PowerPoint import is multipart (.pptx is a binary file, not a JSON body).
// 25 MB memory cap — decks are usually a few MB and the bytes are parsed for
// text, not persisted.
const pptxUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

  // Import a PowerPoint (.pptx) as the rendered deck — parsed server-side
  // into slides, then persisted exactly like a JSON replace. multipart;
  // field name `file`. Inherits requireAuth + staff-role from the router;
  // rate-limited per user since server-side parsing is CPU/memory-bound.
  router.post(
    '/:id/slides/import-pptx',
    buildPptxImportLimiter(),
    pptxUpload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file?.buffer?.length) {
          throw new HttpError(422, 'VALIDATION_FAILED', 'No PowerPoint file was uploaded.');
        }
        const material = await importPptxSlides(
          req.auth!,
          req.params.id ?? '',
          req.file.buffer,
          requestContext(req),
        );
        res.status(200).json({ data: { material: toMaterialDetailDto(material) } });
      } catch (err) {
        next(err);
      }
    },
  );

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
