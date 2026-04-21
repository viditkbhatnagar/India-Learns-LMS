import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { listForStaff } from '../services/ticketService.js';

const ListQuerySchema = z.object({
  category: z
    .enum(['academic', 'administration', 'finance', 'technical', 'complaints'])
    .optional(),
  state: z
    .enum(['open', 'assigned', 'in_progress', 'resolved', 'closed'])
    .optional(),
  studentId: z.string().min(1).optional(),
  slaBreached: z.enum(['ack', 'resolve', 'any']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v > 0 && v <= 500),
      { message: 'limit must be 1..500' },
    ),
});

export function staffTicketsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('faculty', 'finance', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = ListQuerySchema.parse(req.query);
        const tickets = await listForStaff(req.auth!, parsed);
        res.json({ data: { tickets } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
