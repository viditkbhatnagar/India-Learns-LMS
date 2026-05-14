import { Types } from 'mongoose';
import type {
  ApplicantSignupInput,
  ApplicationDto,
  OfficerApplicationListQuery,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Application,
  User,
  type HydratedApplication,
  type HydratedUser,
} from '../../models/index.js';
import { recordAudit, scrubUser } from '../auditService.js';
import { nextApplicationCode } from '../counterService.js';
import { hashPassword, validatePolicy } from '../passwordService.js';
import { signAccessToken } from '../tokenService.js';
import { issueRefreshToken } from '../refreshTokenService.js';

export interface ApplicantSignupContext {
  ip: string;
  ua: string;
  deviceId: string;
}

export interface ApplicantSignupResult {
  application: HydratedApplication;
  user: HydratedUser;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

// M1 — Phase 1 is over-18 only (Logan stakeholder answer). The DOB lives on
// the Application form (M2 Step 2), not on signup. We do, however, accept
// programId at signup time so the dashboard can show "applying to <Program>".
// If Logan asks for under-18 hold-for-review later (Q9), the rejection
// happens at Step 2 of the form, not here.

export async function applicantSignup(
  input: ApplicantSignupInput,
  ctx: ApplicantSignupContext,
): Promise<ApplicantSignupResult> {
  validatePolicy(input.password);

  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(
      409,
      'USER_EXISTS',
      'An account with this email already exists. Use Resume Application to sign in.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    role: 'applicant',
    code: null,
    name: input.name.trim(),
    email,
    phoneE164: input.phoneE164.trim(),
    passwordHash,
    passwordUpdatedAt: new Date(),
    status: 'active',
    lastLoginAt: new Date(),
  });

  let programId: Types.ObjectId | null = null;
  if (input.programId) {
    if (!Types.ObjectId.isValid(input.programId)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid programId.');
    }
    programId = new Types.ObjectId(input.programId);
  }

  const code = await nextApplicationCode(new Date().getUTCFullYear());
  const application = await Application.create({
    code,
    applicantUserId: user._id,
    programId,
    state: 'draft',
  });

  await recordAudit({
    actorUserId: user._id,
    action: 'admission.applicant.signed_up',
    targetType: 'Application',
    targetId: application._id,
    details: { applicationCode: code, programId: programId?.toString() ?? null },
    before: null,
    after: scrubUser(user.toObject()),
    ip: ctx.ip,
    ua: ctx.ua,
  });

  const { token, expiresIn } = await signAccessToken(user);
  const refresh = await issueRefreshToken(user, ctx);

  return {
    application,
    user,
    accessToken: token,
    accessTokenExpiresIn: expiresIn,
    refreshToken: refresh.plain,
  };
}

export interface ListApplicationsResult {
  items: ApplicationDto[];
  total: number;
  page: number;
  limit: number;
}

export async function listApplicationsForOfficer(
  q: OfficerApplicationListQuery,
): Promise<ListApplicationsResult> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (q.state) filter.state = q.state;
  if (q.programId && Types.ObjectId.isValid(q.programId)) {
    filter.programId = new Types.ObjectId(q.programId);
  }

  let userIdFilter: Types.ObjectId[] | null = null;
  if (q.q) {
    const safe = q.q.trim().replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(safe, 'i');
    // M1 search supports applicant name/email + application code. Code lives
    // on Application; name/email live on User — resolve user-side first then
    // intersect, otherwise we'd need a $lookup pipeline.
    const matchingUsers = await User.find({
      role: 'applicant',
      $or: [{ name: re }, { email: re }],
    })
      .select('_id')
      .limit(500);
    userIdFilter = matchingUsers.map((u) => u._id);
    filter.$or = [
      { code: re },
      { applicantUserId: { $in: userIdFilter } },
    ];
  }

  const [docs, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Application.countDocuments(filter),
  ]);

  const applicantIds = Array.from(
    new Set(docs.map((d) => d.applicantUserId.toString())),
  ).map((id) => new Types.ObjectId(id));
  const applicants = applicantIds.length
    ? await User.find({ _id: { $in: applicantIds } })
        .select('_id name email')
        .lean()
    : [];
  const byId = new Map(applicants.map((u) => [String(u._id), u]));

  const items = docs.map((doc) => toApplicationDto(doc, byId.get(doc.applicantUserId.toString())));
  return { items, total, page, limit };
}

export async function findApplicationForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<HydratedApplication> {
  const doc = await Application.findOne({ applicantUserId });
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  return doc;
}

interface AppliantMini {
  name?: string;
  email?: string;
}

export function toApplicationDto(
  doc: HydratedApplication,
  applicant?: AppliantMini | null,
): ApplicationDto {
  const decisionDoc = doc.decision;
  const decisionPayload =
    decisionDoc.decision
      ? {
          decision: decisionDoc.decision,
          decidedAt: decisionDoc.decidedAt ? decisionDoc.decidedAt.toISOString() : null,
          decidedBy: decisionDoc.decidedBy ? decisionDoc.decidedBy.toString() : null,
          // Only `reasonApplicant` is surfaced to the applicant; the internal
          // reason stays officer-only.
          reasonApplicant: decisionDoc.reasonApplicant ?? null,
        }
      : null;
  return {
    id: String(doc._id),
    code: doc.code,
    applicantUserId: doc.applicantUserId.toString(),
    applicantName: applicant?.name ?? '',
    applicantEmail: applicant?.email ?? '',
    programId: doc.programId ? doc.programId.toString() : null,
    state: doc.state,
    submittedAt: doc.submittedAt ? doc.submittedAt.toISOString() : null,
    decision: decisionPayload,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
