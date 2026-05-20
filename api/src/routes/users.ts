import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  createUser,
  findUserById,
  listUsers,
  resendInvite,
  softDeleteUser,
  suspendUser,
  toUserDto,
  unsuspendUser,
  updateUser,
} from '../services/userService.js';

const RoleEnum = z.enum([
  'admin',
  'finance',
  'faculty',
  'student',
  // M1 admissions — admins seed officer accounts via the existing user-create
  // flow. Applicants are NOT createable through this admin route — they
  // self-sign-up via /v1/admissions/apply/signup. Including 'applicant' here
  // would expose an admin-controlled bypass of the public funnel.
  'admissions_officer',
]);
const DeptEnum = z.enum(['operations', 'it', 'academics', 'finance', 'senior_mgmt']);

const CreateBody = z.object({
  role: RoleEnum,
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phoneE164: z.string().regex(/^\+\d{6,15}$/),
  programId: z.string().optional(),
  batchId: z.string().optional(),
  enrolmentValidFrom: z.string().datetime().optional(),
  enrolmentValidTo: z.string().datetime().optional(),
  deptTag: DeptEnum.optional(),
  isCourseCoordinator: z.boolean().optional(),
});

// M10 — Personal-detail subschemas (Profile screen + apply→convert copy).
// Phones are E.164 (`+` + 6–15 digits). Email is optional on the contact
// subdocs since parents/guardians often don't have one to give.
const PersonalAddressBody = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  stateProvince: z.string().max(120).default(''),
  postalCode: z.string().max(32).default(''),
  country: z.string().min(1).max(80),
});

const ContactRefBody = z
  .object({
    name: z.string().min(1).max(120),
    relationship: z.string().max(60).default(''),
    phoneE164: z.string().regex(/^\+\d{6,15}$/),
    email: z.string().email().max(254).nullable().optional(),
  })
  // Normalise `email` to the DTO shape (`string | null`, never `undefined`)
  // so service-layer and Mongoose see one canonical form.
  .transform((v) => ({ ...v, email: v.email ?? null }));

const UpdateBody = z.object({
  name: z.string().min(1).max(120).optional(),
  phoneE164: z.string().regex(/^\+\d{6,15}$/).optional(),
  address: z.string().max(500).nullable().optional(),
  programId: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  enrolmentValidFrom: z.string().datetime().nullable().optional(),
  enrolmentValidTo: z.string().datetime().nullable().optional(),
  deptTag: DeptEnum.nullable().optional(),
  isCourseCoordinator: z.boolean().optional(),
  // M10 — Personal details (LMS_Requirements §1). Accept YYYY-MM-DD or
  // full ISO; the service truncates to a UTC date-only value.
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dateOfBirth must be YYYY-MM-DD or ISO.')
    .nullable()
    .optional(),
  personalAddress: PersonalAddressBody.nullable().optional(),
  emergencyContact: ContactRefBody.nullable().optional(),
  parentGuardian: ContactRefBody.nullable().optional(),
  // M10f — Placement resume URL. Accept null to clear.
  resumeUrl: z.string().url().max(1024).nullable().optional(),
});

const ListQuery = z.object({
  role: z
    .enum([
      'admin',
      'superadmin',
      'finance',
      'faculty',
      'student',
      'applicant',
      'admissions_officer',
    ])
    .optional(),
  status: z.enum(['pending', 'active', 'suspended', 'revoked']).optional(),
  programId: z.string().min(1).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const SuspendBody = z.object({ reason: z.string().min(1).max(500) });

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function usersRouter(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get('/me', (req: Request, res: Response) => {
    res.status(200).json({ data: { user: toUserDto(req.auth!.user) } });
  });

  router.get(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListQuery.parse(req.query);
        const result = await listUsers(query);
        res.status(200).json({
          data: {
            items: result.items.map(toUserDto),
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
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createUser(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findUserById((req.params.id ?? ''));
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
        const isSelf = doc._id.equals(req.auth!.userId);
        const canView = isSelf || req.auth!.role === 'admin' || req.auth!.role === 'superadmin';
        if (!canView) throw new HttpError(403, 'FORBIDDEN', 'Access denied.');
        res.status(200).json({ data: { user: toUserDto(doc) } });
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
        const doc = await updateUser((req.params.id ?? ''), body, {
          role: req.auth!.role,
          userId: req.auth!.userId,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/suspend',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SuspendBody.parse(req.body);
        const doc = await suspendUser((req.params.id ?? ''), body.reason, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/unsuspend',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await unsuspendUser((req.params.id ?? ''), {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/resend-invite',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await resendInvite((req.params.id ?? ''), {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await softDeleteUser((req.params.id ?? ''), {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { user: toUserDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
