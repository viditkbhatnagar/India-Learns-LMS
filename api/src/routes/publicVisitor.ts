import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  VISITOR_LEAD_SOURCES,
  VISITOR_QUALIFICATIONS,
} from 'india-learns-shared-types';
import { buildPublicVisitorLimiter } from '../middleware/rateLimit.js';
import { User } from '../models/index.js';
import {
  createVisitorLead,
  toVisitorLeadDto,
} from '../services/visitorLeadService.js';
import { phoneE164Schema } from '../utils/phone.js';

// M10u — Public visitor self-registration. Prospect submits the form
// from a marketing page without logging in. We:
//   1. Rate-limit per IP (5/hr) — see buildPublicVisitorLimiter.
//   2. Force `otpVerificationStatus = 'pending'` regardless of input.
//   3. Attribute the createdByUserId to the first active superadmin so
//      the audit log still has a stable actor (no anonymous writes).
//
// Admin sees the lead at /admin/visitor-leads and follows up. OTP send
// is NOT enabled (Logan: "except sending otp build everything").

const AddressBody = z.object({
  street: z.string().max(200).default(''),
  city: z.string().max(120).default(''),
  stateProvince: z.string().max(120).default(''),
  postalCode: z.string().max(20).default(''),
  country: z.string().max(60).default('India'),
});

const Body = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  highestQualification: z.enum(VISITOR_QUALIFICATIONS).nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'dateOfBirth must be YYYY-MM-DD or ISO.')
    .nullable()
    .optional(),
  currentAddress: AddressBody.nullable().optional(),
  phoneE164: phoneE164Schema,
  email: z.string().email().max(254).nullable().optional(),
  parentGuardianContact: z.string().max(200).nullable().optional(),
  leadSource: z.enum(VISITOR_LEAD_SOURCES),
  socialMediaId: z.string().max(300).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export function publicVisitorRouter(): Router {
  const router = Router();
  const limiter = buildPublicVisitorLimiter();

  router.post(
    '/register',
    limiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = Body.parse(req.body);

        // Find a system actor. Prefer the first active superadmin so
        // every audit row points at a real user; if none exists (super
        // fresh install) fall back to a synthetic ObjectId so the
        // service-layer call still typechecks. Either way we always
        // force otpVerificationStatus='pending' + status='new'.
        const sysActor = await User.findOne({
          role: 'superadmin',
          status: 'active',
          deletedAt: null,
        }).select('_id');
        const systemUserId = sysActor?._id ?? new Types.ObjectId();

        const doc = await createVisitorLead(
          {
            ...body,
            otpVerificationStatus: 'pending',
            status: 'new',
          },
          {
            actorUserId: systemUserId,
            ip: req.ip ?? '',
            ua: req.header('user-agent') ?? 'public-form',
          },
        );
        // Return a sanitized response — don't echo back fields we don't
        // want public consumers to depend on (createdByUserId / audit
        // metadata). The full DTO is fine here since the form is
        // submitted by the prospect themselves; admin sees the same.
        res.status(201).json({ data: { lead: toVisitorLeadDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
