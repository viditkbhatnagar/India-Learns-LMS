import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { StorageFolder } from 'india-learns-shared-types';
import { STORAGE_FOLDERS } from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { getIntegrations } from '../integrations/index.js';
import { fetchGridfsFile } from '../integrations/mongoStorageAdapter.js';
import { fetchS3File } from '../integrations/s3StorageAdapter.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

// Generic file routes. Bytes live in S3 (default) or GridFS (legacy).
// The public URL contract `/v1/files/:id` is the same for both — the id
// is a 24-char ObjectId that points at either a FileMeta record (S3) or
// a GridFS file with that _id.
//
// POST /v1/files/upload?folder=<folder>
//   - multipart/form-data, field name `file`.
//   - Returns { data: { url, key } } using the configured storage adapter.
//   - Works with any adapter that implements `StorageAdapter.upload`.
//   - 5 MB cap; raise later for video.
//
// GET /v1/files/:id
//   - Streams the file back to the browser. Requires auth (cookie).
//   - Resolution order: S3 (FileMeta lookup) → GridFS fallback.
//     During the GridFS→S3 migration both will exist; once the migration
//     is complete, every id resolves via FileMeta.

const FOLDERS = new Set<StorageFolder>(STORAGE_FOLDERS as readonly StorageFolder[]);

const UploadQuery = z.object({
  folder: z
    .string()
    .refine((v): v is StorageFolder => FOLDERS.has(v as StorageFolder), {
      message: 'Unknown folder.',
    }),
});

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export function filesRouter(): Router {
  const router = Router();

  router.post(
    '/upload',
    requireAuth,
    memoryUpload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = UploadQuery.safeParse(req.query);
        if (!parsed.success) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'Unknown or missing `folder` query param.',
          );
        }
        const { file } = req as Request & { file?: Express.Multer.File };
        if (!file) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'Missing `file` field in multipart body.',
          );
        }
        const { storage } = getIntegrations();
        const result = await storage.upload({
          bytes: file.buffer,
          filename: file.originalname || 'upload.bin',
          folder: parsed.data.folder,
          contentType: file.mimetype || 'application/octet-stream',
        });
        logger.info(
          {
            actor: req.auth!.userId.toHexString(),
            role: req.auth!.role,
            folder: parsed.data.folder,
            bytes: file.size,
            key: result.key,
          },
          'files.upload',
        );
        res.status(201).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!id) {
          throw new HttpError(404, 'NOT_FOUND', 'File not found.');
        }
        const env = loadEnv();
        // Try S3 first when it's the configured provider; fall back to
        // GridFS for any file that hasn't been migrated yet (and vice
        // versa, so a host reconfigured to STORAGE_PROVIDER=mongo can
        // still serve already-uploaded S3 files).
        const s3First = env.STORAGE_PROVIDER === 's3';
        const found = s3First
          ? (await fetchS3File(id)) ?? (await fetchGridfsFile(id))
          : (await fetchGridfsFile(id)) ?? (await fetchS3File(id));
        if (!found) {
          throw new HttpError(404, 'NOT_FOUND', 'File not found.');
        }
        if (found.contentType) {
          res.setHeader('content-type', found.contentType);
        }
        if (found.length) {
          res.setHeader('content-length', String(found.length));
        }
        res.setHeader(
          'content-disposition',
          `inline; filename="${encodeURIComponent(found.filename)}"`,
        );
        res.setHeader('cache-control', 'private, max-age=300');
        found.stream.on('error', (err) => next(err));
        found.stream.pipe(res);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
