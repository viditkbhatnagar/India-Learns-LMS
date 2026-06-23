import { Types } from 'mongoose';
import type {
  CreateUserInput,
  Role,
  UpdateUserInput,
  UserListQuery,
  UserPublicDto,
  UserStatus,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { getIntegrations } from '../integrations/index.js';
import { User, type HydratedUser } from '../models/index.js';
import { recordAudit, scrubUser } from './auditService.js';
import { nextUserCode } from './counterService.js';
import { createInviteToken } from './inviteService.js';
import { revokeAllForUser } from './refreshTokenService.js';

export interface ActorContext {
  actorUserId: Types.ObjectId | null;
  ip: string;
  ua: string;
}

const ROLES_WITH_CODE: ReadonlySet<Role> = new Set(['student', 'faculty']);

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  return new Types.ObjectId(id);
}

function inviteLink(token: string): string {
  const env = loadEnv();
  // Must point at the real, token-driven accept-invite page (reads ?t= and
  // sets the password). /onboarding/set-password is a static demo screen
  // that ignores the token, so invitees landed on "Invalid invite link".
  return `${env.WEB_ORIGIN.replace(/\/$/, '')}/accept-invite?t=${encodeURIComponent(token)}`;
}

function toDto(doc: HydratedUser): UserPublicDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  const toIdString = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Types.ObjectId) return v.toString();
    return String(v);
  };
  return {
    id: String(json.id),
    role: json.role as UserPublicDto['role'],
    code: (json.code as string | null) ?? null,
    name: json.name as string,
    email: json.email as string,
    phoneE164: json.phoneE164 as string,
    status: json.status as UserStatus,
    suspensionKind: (json.suspensionKind as UserPublicDto['suspensionKind']) ?? null,
    suspensionReason: (json.suspensionReason as string | null) ?? null,
    lastLoginAt: iso(json.lastLoginAt),
    programId: toIdString(json.programId),
    batchId: toIdString(json.batchId),
    enrolmentValidFrom: iso(json.enrolmentValidFrom),
    enrolmentValidTo: iso(json.enrolmentValidTo),
    deptTag: (json.deptTag as UserPublicDto['deptTag']) ?? null,
    isCourseCoordinator: Boolean(json.isCourseCoordinator),
    address: (json.address as string | null) ?? null,
    // M10 — Personal-detail expansion. dateOfBirth is serialized as a
    // YYYY-MM-DD slug (no time portion) since hours/minutes are noise on
    // a birthdate. Subdocs are nulled when absent so the web side can
    // skip rendering instead of checking for shape.
    dateOfBirth: (() => {
      const v = json.dateOfBirth;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'string' && v.length >= 10) return v.slice(0, 10);
      return null;
    })(),
    personalAddress: (json.personalAddress as UserPublicDto['personalAddress']) ?? null,
    emergencyContact: (json.emergencyContact as UserPublicDto['emergencyContact']) ?? null,
    parentGuardian: (json.parentGuardian as UserPublicDto['parentGuardian']) ?? null,
    // M10f — Placement resume URL.
    resumeUrl: (json.resumeUrl as string | null) ?? null,
    // M10x — Marketing source attribution.
    source: (json.source as UserPublicDto['source']) ?? null,
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
    deletedAt: iso(json.deletedAt),
  };
}

export { toDto as toUserDto };

export async function findUserByEmail(email: string): Promise<HydratedUser | null> {
  return User.findOne({ email: email.trim().toLowerCase() });
}

export async function findUserById(id: string): Promise<HydratedUser | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return User.findById(id);
}

export async function sendInvite(user: HydratedUser): Promise<void> {
  const { plain } = await createInviteToken(user._id, 'invite');
  const link = inviteLink(plain);
  const { email, whatsapp } = getIntegrations();
  await email.send({
    to: user.email,
    subject: 'Welcome to India Learns — set your password',
    html: `<p>Hi ${user.name},</p><p>Your India Learns account is ready. Set your password and log in using the link below. It expires in 7 days.</p><p><a href="${link}">${link}</a></p>`,
    text: `Hi ${user.name},\n\nYour India Learns account is ready. Set your password using this link (expires in 7 days):\n${link}\n`,
    tag: 'invite',
    vars: { name: user.name, inviteUrl: link },
  });
  // WhatsApp is a best-effort courtesy; never block the invite on it.
  try {
    await whatsapp.sendTemplate({
      toE164: user.phoneE164,
      templateName: 'il_welcome',
      languageCode: 'en',
      vars: [user.name, link],
    });
  } catch {
    // swallow — logged by the adapter
  }
}

export async function createUser(
  input: CreateUserInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedUser> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    // TRD §5.2 + PRD §3.1: only admin creates users.
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may create users.');
  }
  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new HttpError(409, 'USER_EXISTS', 'A user with this email already exists.');
  }
  const code = ROLES_WITH_CODE.has(input.role)
    ? await nextUserCode(new Date().getUTCFullYear())
    : null;
  // M10v — Optional Section 1 fields. dateOfBirth accepts YYYY-MM-DD or
  // full ISO and is stored as a UTC date-only Date (midnight). The
  // contact subdocs land directly if present, else null.
  let dob: Date | null = null;
  if (input.dateOfBirth) {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.dateOfBirth);
    if (ymd) {
      dob = new Date(
        Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])),
      );
    }
  }

  const doc = await User.create({
    role: input.role,
    code,
    name: input.name.trim(),
    email,
    phoneE164: input.phoneE164.trim(),
    status: 'pending',
    programId: input.programId ?? null,
    batchId: input.batchId ?? null,
    enrolmentValidFrom: input.enrolmentValidFrom ?? null,
    enrolmentValidTo: input.enrolmentValidTo ?? null,
    deptTag: input.deptTag ?? null,
    isCourseCoordinator: input.isCourseCoordinator ?? false,
    dateOfBirth: dob,
    personalAddress: input.personalAddress ?? null,
    emergencyContact: input.emergencyContact ?? null,
    parentGuardian: input.parentGuardian ?? null,
    // M10x — Marketing source attribution (Excel "Source" column).
    source: input.source ?? null,
  });
  await sendInvite(doc);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.created',
    targetType: 'User',
    targetId: doc._id,
    before: null,
    after: scrubUser(doc.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function listUsers(query: UserListQuery): Promise<{
  items: HydratedUser[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.programId && Types.ObjectId.isValid(query.programId)) {
    filter.programId = new Types.ObjectId(query.programId);
  }
  if (query.q) {
    const safe = query.q.trim().replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { code: { $regex: safe, $options: 'i' } },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

// M10 — Personal-detail fields students can self-edit on their Profile
// screen. dateOfBirth is technically self-editable too; in practice the
// admissions team sets it during apply and students rarely need to change
// it, but we allow it for the case where it was entered wrong.
const SELF_PATCH_FIELDS = new Set<keyof UpdateUserInput>([
  'name',
  'phoneE164',
  'address',
  'dateOfBirth',
  'personalAddress',
  'emergencyContact',
  'parentGuardian',
  // M10f — Placement resume URL is self-editable on the Profile screen.
  'resumeUrl',
]);

export async function updateUser(
  id: string,
  patch: UpdateUserInput,
  actor: { role: Role; userId: Types.ObjectId } & ActorContext,
): Promise<HydratedUser> {
  const targetId = requireId(id);
  const doc = await User.findById(targetId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  const isSelf = targetId.equals(actor.userId);
  const isAdmin = actor.role === 'admin' || actor.role === 'superadmin';
  if (!isAdmin && !isSelf) {
    throw new HttpError(403, 'FORBIDDEN', 'Cannot edit another user.');
  }
  if (!isAdmin) {
    for (const key of Object.keys(patch) as (keyof UpdateUserInput)[]) {
      if (!SELF_PATCH_FIELDS.has(key)) {
        throw new HttpError(403, 'FORBIDDEN', `Field ${key} cannot be self-edited.`);
      }
    }
  }
  const before = scrubUser(doc.toObject());
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.phoneE164 !== undefined) doc.phoneE164 = patch.phoneE164.trim();
  if (patch.address !== undefined) {
    doc.address = patch.address === null ? null : patch.address.trim() || null;
  }
  // M10 — Personal details. Pass null to clear; the contact subdocs
  // require all required fields if set (Mongoose enforces via the
  // subdoc validators). dateOfBirth accepts YYYY-MM-DD; we parse into
  // a UTC Date — the date is what matters, not the time.
  if (patch.dateOfBirth !== undefined) {
    if (patch.dateOfBirth === null) {
      doc.dateOfBirth = null;
    } else {
      const trimmed = patch.dateOfBirth.trim();
      // Tolerate full ISO strings but persist as a date-only UTC value.
      const slug = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
      const parsed = new Date(`${slug}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'dateOfBirth must be a valid date.');
      }
      doc.dateOfBirth = parsed;
    }
  }
  if (patch.personalAddress !== undefined) {
    doc.personalAddress = patch.personalAddress
      ? {
          street: patch.personalAddress.street.trim(),
          city: patch.personalAddress.city.trim(),
          stateProvince: patch.personalAddress.stateProvince.trim(),
          postalCode: patch.personalAddress.postalCode.trim(),
          country: patch.personalAddress.country.trim(),
        }
      : null;
  }
  if (patch.emergencyContact !== undefined) {
    doc.emergencyContact = patch.emergencyContact
      ? {
          name: patch.emergencyContact.name.trim(),
          relationship: patch.emergencyContact.relationship.trim(),
          phoneE164: patch.emergencyContact.phoneE164.trim(),
          email: patch.emergencyContact.email?.trim() || null,
        }
      : null;
  }
  if (patch.parentGuardian !== undefined) {
    doc.parentGuardian = patch.parentGuardian
      ? {
          name: patch.parentGuardian.name.trim(),
          relationship: patch.parentGuardian.relationship.trim(),
          phoneE164: patch.parentGuardian.phoneE164.trim(),
          email: patch.parentGuardian.email?.trim() || null,
        }
      : null;
  }
  // M10f — Placement resume URL. Empty string normalises to null so
  // "clear it" works from the UI without a separate DELETE endpoint.
  if (patch.resumeUrl !== undefined) {
    const trimmed = patch.resumeUrl?.trim();
    doc.resumeUrl = trimmed || null;
  }
  if (isAdmin) {
    if (patch.programId !== undefined) {
      doc.programId = patch.programId ? new Types.ObjectId(patch.programId) : null;
    }
    if (patch.batchId !== undefined) {
      doc.batchId = patch.batchId ? new Types.ObjectId(patch.batchId) : null;
    }
    if (patch.enrolmentValidFrom !== undefined) {
      doc.enrolmentValidFrom = patch.enrolmentValidFrom
        ? new Date(patch.enrolmentValidFrom)
        : null;
    }
    if (patch.enrolmentValidTo !== undefined) {
      doc.enrolmentValidTo = patch.enrolmentValidTo
        ? new Date(patch.enrolmentValidTo)
        : null;
    }
    if (patch.deptTag !== undefined) doc.deptTag = patch.deptTag;
    if (patch.isCourseCoordinator !== undefined) {
      doc.isCourseCoordinator = patch.isCourseCoordinator;
    }
    // M10x — Marketing source. Admin-only field.
    if (patch.source !== undefined) {
      doc.source = patch.source;
    }
  }
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.updated',
    targetType: 'User',
    targetId: doc._id,
    before,
    after: scrubUser(doc.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function suspendUser(
  id: string,
  reason: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedUser> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may suspend users.');
  }
  const targetId = requireId(id);
  const doc = await User.findById(targetId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  const before = scrubUser(doc.toObject());
  doc.status = 'suspended';
  doc.suspensionKind = 'manual';
  doc.suspensionReason = reason.trim() || 'No reason given';
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.suspended',
    targetType: 'User',
    targetId: doc._id,
    before,
    after: scrubUser(doc.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function unsuspendUser(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedUser> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may unsuspend users.');
  }
  const targetId = requireId(id);
  const doc = await User.findById(targetId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  const before = scrubUser(doc.toObject());
  doc.status = doc.passwordHash ? 'active' : 'pending';
  doc.suspensionKind = null;
  doc.suspensionReason = null;
  doc.suspensionOverrideUntil = null;
  doc.suspensionOverrideBy = null;
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.unsuspended',
    targetType: 'User',
    targetId: doc._id,
    before,
    after: scrubUser(doc.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function resendInvite(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedUser> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may resend invites.');
  }
  const doc = await User.findById(requireId(id));
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  if (doc.status !== 'pending') {
    throw new HttpError(
      409,
      'VALIDATION_FAILED',
      'Cannot resend invite — user has already set a password.',
    );
  }
  await sendInvite(doc);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.invite_resent',
    targetType: 'User',
    targetId: doc._id,
    before: null,
    after: scrubUser(doc.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function softDeleteUser(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedUser> {
  if (actor.role !== 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may delete users.');
  }
  const targetId = requireId(id);
  const doc = await User.findById(targetId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  const before = scrubUser(doc.toObject());
  // M10r — use updateOne so legacy enum values on untouched fields (e.g.
  // a stale `role: 'finance'` after D-095) don't block the soft-delete.
  // We still PII-scrub email/phone and revoke credentials. Validators on
  // the fields we DO touch run via the explicit `runValidators` flag.
  const update = {
    status: 'revoked' as const,
    deletedAt: new Date(),
    email: `deleted+${String(doc._id)}@removed.invalid`,
    phoneE164: '+10000000000',
    passwordHash: null,
    passwordHistoryHashes: [] as string[],
  };
  await User.updateOne({ _id: doc._id }, { $set: update }, { runValidators: true });
  // Hydrate the saved state for the audit + return value.
  const after = await User.findById(doc._id);
  if (!after) throw new HttpError(500, 'INTERNAL', 'Soft-deleted user vanished.');
  await revokeAllForUser(after._id);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.deleted',
    targetType: 'User',
    targetId: after._id,
    before,
    after: scrubUser(after.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return after;
}
