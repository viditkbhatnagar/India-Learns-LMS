import { Types } from 'mongoose';
import type { CredentialedUserDto, Role } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Enrollment,
  FacultyCredential,
  User,
  type HydratedUser,
} from '../models/index.js';
import { hashPassword, validatePolicy } from './passwordService.js';
import { nextUserCode } from './counterService.js';
import { recordAudit, scrubUser } from './auditService.js';
import { revokeAllForUser } from './refreshTokenService.js';
import { enrolStudentInProgram } from './enrollmentService.js';
import type { ActorContext } from './userService.js';
import { generatePassword } from '../utils/generatePassword.js';
import { open, seal } from '../utils/secretBox.js';
import { logger } from '../config/logger.js';

// Generalized "create a login with a generated, persisted (encrypted) password"
// for ANY role (student/faculty/admin/admissions_officer) — the mechanism the
// admin Users screen uses since email invites are off. The faculty-specific
// service delegates here. Credentials live in the shared `facultycredentials`
// collection (role-agnostic; keyed by userId).

export type Actor = { role: Role } & ActorContext;

const ROLES_WITH_CODE = new Set<Role>(['student', 'faculty']);
// Admin can provision these directly. Applicants self-sign-up, so they're out.
const PROVISIONABLE_ROLES = new Set<Role>([
  'student',
  'faculty',
  'admin',
  'admissions_officer',
]);
const ENROL_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;

export function assertAdmin(role: Role): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may manage user logins.');
  }
}

function decryptSecret(sealed: string | undefined): string | null {
  if (!sealed) return null;
  try {
    return open(sealed);
  } catch {
    // Key unset/rotated — degrade to null rather than failing the whole list.
    return null;
  }
}

export function toCredentialedUserDto(
  user: HydratedUser,
  password: string | null,
): CredentialedUserDto {
  return {
    id: String(user._id),
    role: user.role,
    code: user.code ?? null,
    name: user.name,
    email: user.email,
    phoneE164: user.phoneE164,
    status: user.status,
    password,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export interface CreateUserAccountInput {
  role: Role;
  name: string;
  email: string;
  phoneE164: string;
  programId?: string | null;
  batchId?: string | null;
  enrol?: boolean;
}

export interface CreateUserAccountResult {
  user: HydratedUser;
  temporaryPassword: string;
  enrolmentsCount: number;
  // Set when enrolment was requested but produced no course access (e.g. the
  // program has no courses yet). The login is still created — the UI shows
  // this so the admin knows the student is NOT enrolled.
  enrolmentWarning: string | null;
}

/**
 * Create an active login with an auto-generated password (no email invite).
 * The password is stored encrypted for the admin credentials table. For a
 * student with `enrol` + programId + batchId, also enrols them in the program.
 */
export async function createUserAccount(
  input: CreateUserAccountInput,
  actor: Actor,
): Promise<CreateUserAccountResult> {
  assertAdmin(actor.role);
  if (!PROVISIONABLE_ROLES.has(input.role)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Cannot create a ${input.role} login here.`);
  }
  const email = input.email.trim().toLowerCase();
  if (await User.findOne({ email })) {
    throw new HttpError(409, 'USER_EXISTS', 'A user with this email already exists.');
  }

  const temporaryPassword = generatePassword();
  validatePolicy(temporaryPassword);
  // Seal FIRST so a missing CREDENTIALS_ENC_KEY fails before any rows exist.
  const secret = seal(temporaryPassword);
  const passwordHash = await hashPassword(temporaryPassword);
  const code = ROLES_WITH_CODE.has(input.role)
    ? await nextUserCode(new Date().getUTCFullYear())
    : null;

  const user = await User.create({
    role: input.role,
    code,
    name: input.name.trim(),
    email,
    phoneE164: input.phoneE164.trim(),
    status: 'active',
    passwordHash,
    passwordUpdatedAt: new Date(),
    programId: input.programId ?? null,
    batchId: input.batchId ?? null,
  });
  try {
    await FacultyCredential.create({ userId: user._id, secret });
  } catch (err) {
    // Compensate: never leave an active user with no stored credential.
    await User.deleteOne({ _id: user._id }).catch(() => undefined);
    throw err;
  }

  let enrolmentsCount = 0;
  let enrolmentWarning: string | null = null;
  if (input.role === 'student' && input.enrol && input.programId && input.batchId) {
    // Best-effort: a failed enrolment must NOT undo a successfully created
    // login — the admin can still enrol from Admin → Enrolments.
    try {
      const now = new Date();
      const created = await enrolStudentInProgram(
        {
          studentId: String(user._id),
          programId: input.programId,
          batchId: input.batchId,
          validFrom: now.toISOString(),
          validTo: new Date(now.getTime() + ENROL_WINDOW_MS).toISOString(),
        },
        actor,
      );
      enrolmentsCount = created.length;
      if (enrolmentsCount === 0) {
        enrolmentWarning =
          'The login was created, but no course was found in this program to enrol the student into. Add or import the program’s courses first, then enrol from Admin → Enrolments.';
      }
    } catch (err) {
      // Best-effort: clean up any partial enrolments so we never leave a
      // half-enrolled student (the user was just created, so they own none
      // else). The login still stands; enrol can be redone from Enrolments.
      await Enrollment.deleteMany({ studentId: user._id }).catch(() => undefined);
      enrolmentsCount = 0;
      // Surface WHY enrolment didn't happen so the admin isn't misled into
      // thinking the student has course access (the enrol silently no-op'd
      // before — see D-115).
      enrolmentWarning =
        err instanceof HttpError
          ? `The login was created, but the student was NOT enrolled: ${err.message}`
          : 'The login was created, but the student could not be enrolled — the program may not have any courses yet. Add courses, then enrol from Admin → Enrolments.';
      logger.warn({ err, userId: String(user._id) }, 'userAccount.enrol_failed');
    }
  }

  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.created',
    targetType: 'User',
    targetId: user._id,
    before: null,
    after: scrubUser(user.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return { user, temporaryPassword, enrolmentsCount, enrolmentWarning };
}

/** Generate a fresh password for any credentialed user, re-store it, revoke sessions. */
export async function resetUserPassword(
  id: string,
  actor: Actor,
): Promise<{ temporaryPassword: string }> {
  assertAdmin(actor.role);
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  const user = await User.findOne({ _id: id, deletedAt: null });
  if (!user) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }

  // Target-role guard (mirrors createUserAccount): NEVER let this flow reset a
  // role it can't provision — blocks an admin from resetting a superadmin (and
  // reading the new password) = privilege escalation. Resetting another admin
  // requires superadmin.
  if (!PROVISIONABLE_ROLES.has(user.role)) {
    throw new HttpError(403, 'FORBIDDEN', 'This account cannot be reset here.');
  }
  if (user.role === 'admin' && actor.role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only a superadmin can reset an admin login.');
  }

  const before = scrubUser(user.toObject());
  const temporaryPassword = generatePassword();
  validatePolicy(temporaryPassword);
  const secret = seal(temporaryPassword);
  const passwordHash = await hashPassword(temporaryPassword);

  // Store the new sealed secret BEFORE flipping the hash (safer divergence on
  // a partial failure: old password still works, not locked out).
  await FacultyCredential.findOneAndUpdate(
    { userId: user._id },
    { secret },
    { upsert: true, new: true },
  );
  user.passwordHash = passwordHash;
  user.passwordUpdatedAt = new Date();
  if (user.status === 'pending') user.status = 'active';
  await user.save();
  await revokeAllForUser(user._id);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'user.updated',
    targetType: 'User',
    targetId: user._id,
    before,
    after: scrubUser(user.toObject()),
    ip: actor.ip,
    ua: actor.ua,
  });
  return { temporaryPassword };
}

const LIST_CAP = 500;

/**
 * Users that have a stored generated password, decrypted for the admin table.
 * The recoverable-password table is for handable, non-privileged logins: it
 * NEVER exposes superadmin passwords, and admin rows are visible only to a
 * superadmin. Capped to avoid an unbounded response.
 */
export async function listCredentialedUsers(
  actor: Actor,
  roleFilter?: Role,
): Promise<CredentialedUserDto[]> {
  assertAdmin(actor.role);
  const baseVisible: Role[] = ['student', 'faculty', 'admissions_officer'];
  const visibleRoles: Role[] = actor.role === 'superadmin' ? [...baseVisible, 'admin'] : baseVisible;
  const roles = roleFilter ? visibleRoles.filter((r) => r === roleFilter) : visibleRoles;
  if (roles.length === 0) return [];

  const creds = await FacultyCredential.find({});
  const secretByUser = new Map(creds.map((c) => [String(c.userId), c.secret]));
  const userIds = creds.map((c) => c.userId);

  const users = await User.find({ _id: { $in: userIds }, deletedAt: null, role: { $in: roles } })
    .sort({ createdAt: -1 })
    .limit(LIST_CAP);

  return users.map((u) => toCredentialedUserDto(u, decryptSecret(secretByUser.get(String(u._id)))));
}
