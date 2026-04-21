import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { listForStudent } from '../services/ticketService.js';

const ListQuerySchema = z.object({
  category: z
    .enum(['academic', 'administration', 'finance', 'technical', 'complaints'])
    .optional(),
  state: z
    .enum(['open', 'assigned', 'in_progress', 'resolved', 'closed'])
    .optional(),
  slaBreached: z.enum(['ack', 'resolve', 'any']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 200),
      { message: 'limit must be 1..200' },
    ),
});

/**
 * Mounted at `/v1/me/tickets`. `/v1/tickets/me` aliases this per D-031 to
 * accommodate both the TRD §5.7 path and the milestone-prompt phrasing.
 */
export function meTicketsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = ListQuerySchema.parse(req.query);
        const tickets = await listForStudent(req.auth!.userId, parsed);
        res.json({ data: { tickets } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
