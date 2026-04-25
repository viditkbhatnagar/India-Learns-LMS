import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  getSessionDetail,
  listSessionsForCourse,
  markSessionComplete,
  markSessionIncomplete,
  toSessionDto,
  updateSession,
} from '../services/sessionService.js';
import {
  listAttendance,
  recordAttendance,
} from '../services/attendanceService.js';
import { ATTENDANCE_STATUSES } from '../models/index.js';

const STAFF_ROLES = ['faculty', 'admin', 'superadmin'] as const;

const UpdateBody = z.object({
  title: z.string().min(1).max(240).optional(),
  description: z.string().max(8000).optional(),
  type: z.enum(['lecture', 'seminar', 'workshop', 'tutorial', 'lab', 'assessment', 'exam']).optional(),
  plannedMinutes: z.number().int().min(0).max(600).nullable().optional(),
  scheduledStart: z.string().datetime().nullable().optional(),
  scheduledEnd: z.string().datetime().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(8000).optional(),
  moduleId: z.string().min(1).optional(),
  orderIndex: z.number().int().min(0).max(1_000).optional(),
});

const AttendanceBody = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
      }),
    )
    .min(1)
    .max(200),
});

/** Mounted at /v1/courses/:courseId/sessions. */
export function courseSessionsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await listSessionsForCourse(req.auth!, req.params.courseId ?? '');
      res.json({ data: { sessions } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** Mounted at /v1/sessions. */
export function sessionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole(...STAFF_ROLES));

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await getSessionDetail(req.auth!, req.params.id ?? '');
      res.json({ data: detail });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateBody.parse(req.body);
      const session = await updateSession(req.auth!, req.params.id ?? '', body, {
        ip: req.ip ?? '',
        ua: req.header('user-agent') ?? '',
      });
      res.json({ data: { session: toSessionDto(session) } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await markSessionComplete(req.auth!, req.params.id ?? '', {
        ip: req.ip ?? '',
        ua: req.header('user-agent') ?? '',
      });
      res.json({ data: { session: toSessionDto(session) } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/uncomplete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await markSessionIncomplete(req.auth!, req.params.id ?? '', {
        ip: req.ip ?? '',
        ua: req.header('user-agent') ?? '',
      });
      res.json({ data: { session: toSessionDto(session) } });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/attendance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = AttendanceBody.parse(req.body);
      const result = await recordAttendance(req.auth!, req.params.id ?? '', body.records, {
        ip: req.ip ?? '',
        ua: req.header('user-agent') ?? '',
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/attendance', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await listAttendance(req.auth!, req.params.id ?? '');
      res.json({ data: { records } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
