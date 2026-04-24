import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { AuditLog, User } from '../models/index.js';

const ListQuery = z.object({
  actorId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * GET /v1/audit-logs — admin + superadmin only.
 *
 * Every staff write (suspensions, payments, invoices, tickets, module
 * edits, etc.) is captured here with actor + action + target + before/
 * after + timestamp. The UI uses it for "who changed what and when"
 * quality-assurance queries.
 *
 * Filters: actorId, action, time range. Default returns the last 100
 * entries sorted newest-first. Each row is enriched with the actor's
 * display name so the table can render without a separate lookup.
 */
export function auditLogsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admin', 'superadmin'));

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = ListQuery.parse(req.query);
      const filter: Record<string, unknown> = {};
      if (q.actorId && Types.ObjectId.isValid(q.actorId)) {
        filter.actorUserId = new Types.ObjectId(q.actorId);
      }
      if (q.action) filter.action = q.action;
      const atRange: Record<string, Date> = {};
      if (q.from) atRange.$gte = new Date(q.from);
      if (q.to) atRange.$lt = new Date(q.to);
      if (Object.keys(atRange).length > 0) filter.at = atRange;

      const rows = await AuditLog.find(filter)
        .sort({ at: -1 })
        .limit(q.limit ?? 100)
        .lean();

      // Hydrate the actor's name so the UI doesn't need a join.
      const actorIds = Array.from(
        new Set(
          rows
            .map((r) => (r.actorUserId ? r.actorUserId.toString() : null))
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const actors = actorIds.length > 0
        ? await User.find({ _id: { $in: actorIds } }).select('_id name email role')
        : [];
      const actorMap = new Map<string, { id: string; name: string; email: string; role: string }>();
      actors.forEach((a) =>
        actorMap.set(a._id.toString(), {
          id: a._id.toString(),
          name: a.name,
          email: a.email,
          role: a.role,
        }),
      );

      const items = rows.map((r) => ({
        id: r._id.toString(),
        actorUserId: r.actorUserId ? r.actorUserId.toString() : null,
        actor: r.actorUserId ? actorMap.get(r.actorUserId.toString()) ?? null : null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId ? r.targetId.toString() : null,
        details: r.details,
        ip: r.ip,
        ua: r.ua,
        at: r.at.toISOString(),
      }));

      res.json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
