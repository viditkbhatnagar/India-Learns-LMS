import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { loadEnv } from '../config/env.js';
import { fetchGridfsFile } from '../integrations/mongoStorageAdapter.js';
import { fetchS3File } from '../integrations/s3StorageAdapter.js';
import {
  findActiveShowcaseDocumentById,
  listActiveShowcaseDocuments,
  toShowcaseDocumentDto,
} from '../services/showcaseService.js';

// Showcase — marketing collateral (India Learns company profile + program
// brochures) that staff present in-app. Everything here is STAFF-only
// (admin / superadmin / faculty); students never see this section.
//
// Mounted at /v1/showcase:
//   GET /            — list active docs (metadata only; no GridFS fileId)
//   GET /:id/file    — stream the PDF bytes, staff-gated (keyed by doc id)
//   GET /:id         — single doc metadata
//
// Byte serving lives HERE (not the shared, auth-only GET /v1/files/:id) so
// the bytes inherit this router's requireRole gate and the raw GridFS id is
// never handed to the client. The id→fileId resolution happens server-side.

export function showcaseRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin', 'faculty'));

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const docs = await listActiveShowcaseDocuments();
      res.status(200).json({ data: { items: docs.map(toShowcaseDocumentDto) } });
    } catch (err) {
      next(err);
    }
  });

  // Stream the PDF bytes for an active showcase doc. Resolves the GridFS
  // (or S3) id from the document server-side, so the client only ever knows
  // the ShowcaseDocument id — never the raw file id. Mirrors the resolution
  // order in routes/files.ts but scoped + role-gated to staff.
  router.get('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await findActiveShowcaseDocumentById(req.params.id ?? '');
      const env = loadEnv();
      const s3First = env.STORAGE_PROVIDER === 's3';
      const found = s3First
        ? (await fetchS3File(doc.fileId)) ?? (await fetchGridfsFile(doc.fileId))
        : (await fetchGridfsFile(doc.fileId)) ?? (await fetchS3File(doc.fileId));
      if (!found) {
        throw new HttpError(404, 'NOT_FOUND', 'Showcase file bytes not found.');
      }
      res.setHeader('content-type', found.contentType ?? doc.contentType ?? 'application/pdf');
      if (found.length) {
        res.setHeader('content-length', String(found.length));
      }
      res.setHeader(
        'content-disposition',
        `inline; filename="${encodeURIComponent(found.filename || doc.originalFilename || 'document.pdf')}"`,
      );
      res.setHeader('cache-control', 'private, max-age=300');
      found.stream.on('error', (err) => next(err));
      found.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await findActiveShowcaseDocumentById(req.params.id ?? '');
      res.status(200).json({ data: { document: toShowcaseDocumentDto(doc) } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
