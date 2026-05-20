import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  addComment,
  assignTicket,
  createTicket,
  getTicketDetail,
  listForAdmin,
  reopenTicket,
  requestReopen,
  toTicketCommentDto,
  toTicketDto,
  transitionTicket,
} from '../services/ticketService.js';

const AttachmentInput = z.object({
  url: z.string().min(1).max(2048),
  name: z.string().min(1).max(240),
  size: z.number().int().min(0),
});

const CreateTicketBody = z.object({
  category: z.enum(['academic', 'administration', 'finance', 'technical', 'complaints']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  subject: z.string().min(1).max(240),
  description: z.string().min(1).max(8000),
  linkedCourseId: z.string().min(1).nullable().optional(),
  linkedInvoiceId: z.string().min(1).nullable().optional(),
  attachments: z.array(AttachmentInput).optional(),
});

const AddCommentBody = z.object({
  body: z.string().min(1).max(8000),
  visibility: z.enum(['public', 'internal']).optional(),
  mentionUserIds: z.array(z.string().min(1)).max(20).optional(),
  attachments: z.array(AttachmentInput).optional(),
});

const TransitionBody = z.object({
  to: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
  note: z.string().max(4000).optional(),
});

const ReopenBody = z.object({
  note: z.string().max(4000).optional(),
});

const AssignBody = z.object({
  assigneeUserId: z.string().min(1).nullable(),
  coAssigneeUserIds: z.array(z.string().min(1)).max(20).optional(),
});

const ReopenRequestBody = z.object({
  reason: z.string().min(1).max(4000),
});

const ListQuerySchema = z.object({
  category: z
    .enum(['academic', 'administration', 'finance', 'technical', 'complaints'])
    .optional(),
  state: z
    .enum(['open', 'assigned', 'in_progress', 'resolved', 'closed'])
    .optional(),
  assigneeUserId: z.string().min(1).optional(),
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

export function ticketsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Admin/superadmin global list
  router.get(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = ListQuerySchema.parse(req.query);
        const tickets = await listForAdmin(parsed);
        res.json({ data: { tickets } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Student creates a ticket
  router.post(
    '/',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateTicketBody.parse(req.body);
        const ticket = await createTicket(req.auth!, body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { ticket: toTicketDto(ticket) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Ticket detail — any authenticated user, ACL applied inside service
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const detail = await getTicketDetail(req.auth!, req.params.id ?? '');
        res.json({ data: detail });
      } catch (err) {
        next(err);
      }
    },
  );

  // Add comment — student on own/active, staff any state
  router.post(
    '/:id/comments',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AddCommentBody.parse(req.body);
        const comment = await addComment(req.auth!, req.params.id ?? '', body, {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({ data: { comment: toTicketCommentDto(comment) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // State transition — both POST (TRD §5.7) and PATCH (user prompt) mounted
  const stateHandler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = TransitionBody.parse(req.body);
      const ticket = await transitionTicket(
        req.auth!,
        req.params.id ?? '',
        body.to,
        body.note,
        {
          actorUserId: req.auth!.userId,
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        },
      );
      res.json({ data: { ticket: toTicketDto(ticket) } });
    } catch (err) {
      next(err);
    }
  };
  router.post(
    '/:id/state',
    requireRole('faculty', 'admin', 'superadmin'),
    stateHandler,
  );
  router.patch(
    '/:id/state',
    requireRole('faculty', 'admin', 'superadmin'),
    stateHandler,
  );

  // Staff reopen (7-day window)
  router.post(
    '/:id/reopen',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ReopenBody.parse(req.body ?? {});
        const ticket = await reopenTicket(
          req.auth!,
          req.params.id ?? '',
          body.note,
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.json({ data: { ticket: toTicketDto(ticket) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Reassign ticket — admin + superadmin only
  router.post(
    '/:id/assign',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AssignBody.parse(req.body);
        const ticket = await assignTicket(
          req.auth!,
          req.params.id ?? '',
          body.assigneeUserId,
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
          body.coAssigneeUserIds,
        );
        res.json({ data: { ticket: toTicketDto(ticket) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Student reopen request — creates child ticket
  router.post(
    '/:id/reopen-request',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ReopenRequestBody.parse(req.body);
        const child = await requestReopen(
          req.auth!,
          req.params.id ?? '',
          body.reason,
          {
            actorUserId: req.auth!.userId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? '',
          },
        );
        res.status(201).json({ data: { ticket: toTicketDto(child) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
