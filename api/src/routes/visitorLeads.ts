import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  VISITOR_LEAD_SOURCES,
  VISITOR_LEAD_STATUSES,
  VISITOR_OTP_STATUSES,
  VISITOR_QUALIFICATIONS,
} from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  createVisitorLead,
  findVisitorLeadById,
  listVisitorLeads,
  softDeleteVisitorLead,
  toVisitorLeadDto,
  updateVisitorLead,
} from '../services/visitorLeadService.js';

const AddressBody = z.object({
  street: z.string().max(200).default(''),
  city: z.string().max(120).default(''),
  stateProvince: z.string().max(120).default(''),
  postalCode: z.string().max(20).default(''),
  country: z.string().max(60).default('India'),
});

const CreateBody = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  highestQualification: z.enum(VISITOR_QUALIFICATIONS).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dateOfBirth must be YYYY-MM-DD or ISO.')
    .nullable()
    .optional(),
  currentAddress: AddressBody.nullable().optional(),
  phoneE164: z.string().regex(/^\+\d{6,15}$/),
  email: z.string().email().max(254).nullable().optional(),
  parentGuardianContact: z.string().max(200).nullable().optional(),
  leadSource: z.enum(VISITOR_LEAD_SOURCES),
  socialMediaId: z.string().max(300).nullable().optional(),
  otpVerificationStatus: z.enum(VISITOR_OTP_STATUSES).optional(),
  status: z.enum(VISITOR_LEAD_STATUSES).optional(),
  notes: z.string().max(4000).nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

const UpdateBody = CreateBody.partial();

const ListQuery = z.object({
  status: z.enum(VISITOR_LEAD_STATUSES).optional(),
  leadSource: z.enum(VISITOR_LEAD_SOURCES).optional(),
  otpStatus: z.enum(VISITOR_OTP_STATUSES).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function actorCtx(req: Request) {
  return {
    actorUserId: req.auth!.userId,
    ip: req.ip ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function visitorLeadsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  // Admin / superadmin only. Admissions officers don't get write access by
  // default; expand here if Logan later asks for it.
  router.use(requireRole('admin', 'superadmin'));

  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = ListQuery.parse(req.query);
        const result = await listVisitorLeads(q);
        res.status(200).json({
          data: {
            items: result.items.map(toVisitorLeadDto),
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createVisitorLead(body, actorCtx(req));
        res.status(201).json({ data: { lead: toVisitorLeadDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findVisitorLeadById(req.params.id ?? '');
        res.status(200).json({ data: { lead: toVisitorLeadDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateVisitorLead(req.params.id ?? '', body, actorCtx(req));
        res.status(200).json({ data: { lead: toVisitorLeadDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await softDeleteVisitorLead(req.params.id ?? '', actorCtx(req));
        res.status(200).json({ data: { lead: toVisitorLeadDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
