import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  createEntry,
  deleteEntry,
  findEntryById,
  listEntriesByBatch,
  listEntriesByFaculty,
  toTimetableEntryDto,
  updateEntry,
} from '../services/timetableEntryService.js';

const CreateBody = z.object({
  courseId: z.string().min(1),
  facultyId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTimeMinutes: z.number().int().min(0).max(1440),
  endTimeMinutes: z.number().int().min(0).max(1440),
  room: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

const UpdateBody = z.object({
  courseId: z.string().min(1).optional(),
  facultyId: z.string().min(1).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTimeMinutes: z.number().int().min(0).max(1440).optional(),
  endTimeMinutes: z.number().int().min(0).max(1440).optional(),
  room: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

/**
 * Mounted at `/v1/batches` per `/v1/batches/:id/timetable`.
 */
export function batchTimetableRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:id/timetable',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!Types.ObjectId.isValid(req.params.id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
        }
        const entries = await listEntriesByBatch(new Types.ObjectId(req.params.id));
        const scoped =
          req.auth!.role === 'faculty'
            ? entries.filter((e) => e.facultyId.equals(req.auth!.userId))
            : entries;
        res.status(200).json({
          data: { entries: scoped.map(toTimetableEntryDto) },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/timetable',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createEntry(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { entry: toTimetableEntryDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/**
 * Mounted at `/v1/timetable` for entry-level PATCH/DELETE on `/v1/timetable/:entryId`.
 */
export function timetableEntriesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:entryId',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findEntryById(req.params.entryId ?? '');
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Timetable entry not found.');
        if (
          req.auth!.role === 'faculty'
          && !doc.facultyId.equals(req.auth!.userId)
        ) {
          throw new HttpError(403, 'FORBIDDEN', 'Not your timetable entry.');
        }
        res.status(200).json({ data: { entry: toTimetableEntryDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:entryId',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateEntry(req.params.entryId ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { entry: toTimetableEntryDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:entryId',
    requireRole('admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteEntry(req.params.entryId ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { entry: toTimetableEntryDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

// Re-export for faculty `me` route filtering.
export { listEntriesByFaculty };
