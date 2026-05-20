import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { STAFF_ATTENDANCE_STATUSES } from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  findStaffAttendanceForToday,
  listStaffAttendance,
  markStaffAttendance,
  toStaffAttendanceDto,
} from '../services/staffAttendanceService.js';

const MarkBody = z.object({
  userId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
  status: z.enum(STAFF_ATTENDANCE_STATUSES),
  notes: z.string().max(2000).nullable().optional(),
});

const ListQuery = z.object({
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STAFF_ATTENDANCE_STATUSES).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

function actorCtx(req: Request) {
  return {
    role: req.auth!.role,
    actorUserId: req.auth!.userId,
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function staffAttendanceRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // POST /v1/staff-attendance — faculty self-mark or admin marks on behalf.
  router.post(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = MarkBody.parse(req.body);
        const doc = await markStaffAttendance(body, actorCtx(req));
        res.status(201).json({ data: { attendance: await toStaffAttendanceDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /v1/staff-attendance/me/today — convenience for the faculty
  // dashboard tile so it can show "Marked Present" vs "Not marked".
  router.get(
    '/me/today',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findStaffAttendanceForToday(req.auth!.userId);
        res
          .status(200)
          .json({ data: { attendance: doc ? await toStaffAttendanceDto(doc) : null } });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /v1/staff-attendance — admin view with filters.
  router.get(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = ListQuery.parse(req.query);
        const result = await listStaffAttendance(q);
        const items = await Promise.all(result.items.map(toStaffAttendanceDto));
        res.status(200).json({
          data: { items, total: result.total, page: result.page, limit: result.limit },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
