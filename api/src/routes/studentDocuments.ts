import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  APPLICATION_DOCUMENT_TYPE_LABELS,
  PROGRAM_REQUIRED_DOC_TYPES,
  type ProgramRequiredDocType,
} from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { StudentDocument, User } from '../models/index.js';

// M10k — Student documents routes (LMS_Requirements §1). Admin uploads
// SSLC / +2 / Degree / TC / passport photo / ID proof on behalf of a
// converted student via /admin/users/:id; the student can view (but
// not delete) their own docs on /profile.

const CreateBody = z.object({
  documentType: z.enum(PROGRAM_REQUIRED_DOC_TYPES),
  label: z.string().max(240).optional(),
  url: z.string().url().max(1024),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(128).optional(),
});

function ensureStudentId(idStr: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(idStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }
  return new Types.ObjectId(idStr);
}

function defaultLabel(t: ProgramRequiredDocType): string {
  return APPLICATION_DOCUMENT_TYPE_LABELS[t];
}

interface StudentDocumentDto {
  id: string;
  documentType: ProgramRequiredDocType;
  label: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedByUserId: string;
  uploadedAt: string;
}

function toDto(doc: {
  _id: Types.ObjectId;
  documentType: ProgramRequiredDocType;
  label: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  uploadedByUserId: Types.ObjectId;
  uploadedAt: Date;
}): StudentDocumentDto {
  return {
    id: doc._id.toString(),
    documentType: doc.documentType,
    label: doc.label,
    url: doc.url,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
    uploadedByUserId: doc.uploadedByUserId.toString(),
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

export function studentDocumentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // GET — admin/superadmin/admissions_officer can pull any student;
  // the student themselves can pull their own.
  router.get(
    '/:id/documents',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = ensureStudentId(req.params.id ?? '');
        const isStaff = ['admin', 'superadmin', 'admissions_officer', 'finance'].includes(
          req.auth!.role,
        );
        const isSelf = studentId.equals(req.auth!.userId);
        if (!isStaff && !isSelf) {
          throw new HttpError(403, 'FORBIDDEN', 'Cannot access another student\'s documents.');
        }
        const student = await User.findById(studentId).select({ _id: 1, role: 1 });
        if (!student || student.role !== 'student') {
          throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
        }
        const docs = await StudentDocument.find({ studentId }).sort({ uploadedAt: -1 });
        res.status(200).json({ data: { items: docs.map(toDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST — admin/admissions_officer only.
  router.post(
    '/:id/documents',
    requireRole('admin', 'superadmin', 'admissions_officer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = ensureStudentId(req.params.id ?? '');
        const student = await User.findById(studentId).select({ _id: 1, role: 1 });
        if (!student || student.role !== 'student') {
          throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
        }
        const body = CreateBody.parse(req.body);
        const doc = await StudentDocument.create({
          studentId,
          documentType: body.documentType,
          label: body.label?.trim() || defaultLabel(body.documentType),
          url: body.url.trim(),
          sizeBytes: body.sizeBytes ?? 0,
          mimeType: body.mimeType ?? 'application/octet-stream',
          uploadedByUserId: req.auth!.userId,
          uploadedAt: new Date(),
        });
        res.status(201).json({ data: { document: toDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE — admin only. Student doesn't get to remove their own docs.
  router.delete(
    '/:id/documents/:docId',
    requireRole('admin', 'superadmin', 'admissions_officer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = ensureStudentId(req.params.id ?? '');
        const docId = ensureStudentId(req.params.docId ?? '');
        const doc = await StudentDocument.findOne({ _id: docId, studentId });
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Document not found.');
        await doc.deleteOne();
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

// Self-aliased endpoint for the student profile page.
export function meStudentDocumentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docs = await StudentDocument.find({ studentId: req.auth!.userId }).sort({
        uploadedAt: -1,
      });
      res.status(200).json({ data: { items: docs.map(toDto) } });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
