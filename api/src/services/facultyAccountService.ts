import { Types } from 'mongoose';
import type { CreateFacultyInput, FacultyAccountDto, Role } from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Course,
  FacultyCredential,
  User,
  type HydratedUser,
} from '../models/index.js';
import { hashPassword, validatePolicy } from './passwordService.js';
import { nextUserCode } from './counterService.js';
import { recordAudit, scrubUser } from './auditService.js';
import { revokeAllForUser } from './refreshTokenService.js';
import type { ActorContext } from './userService.js';
import { generatePassword } from '../utils/generatePassword.js';
import { open, seal } from '../utils/secretBox.js';

type Actor = { role: Role } & ActorContext;

function assertAdmin(role: Role): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may manage faculty logins.');
  }
}

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Faculty not found.');
  }
  return new Types.ObjectId(id);
}

export function toFacultyAccountDto(
  user: HydratedUser,
  password: string | null,
  coursesCount: number,
): FacultyAccountDto {
  return {
    id: String(user._id),
    code: user.code ?? null,
    name: user.name,
    email: user.email,
    phoneE164: user.phoneE164,
    status: user.status,
    password,
    coursesCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Create a faculty login with an auto-generated password. The faculty is
 * immediately `active` (can log in with email + password), and the password
 * is stored encrypted so the admin can re-read it later. Returns the created
 * user plus the plaintext password (shown once in the create response).
 */
export async function createFacultyAccount(
  input: CreateFacultyInput,
  actor: Actor,
): Promise<{ user: HydratedUser; temporaryPassword: string }> {
  assertAdmin(actor.role);
  const email = input.email.trim().toLowerCase();
  if (await User.findOne({ email })) {
    throw new HttpError(409, 'USER_EXISTS', 'A user with this email already exists.');
  }

  const temporaryPassword = generatePassword();
  validatePolicy(temporaryPassword);
  // Seal FIRST so a missing CREDENTIALS_ENC_KEY fails before we create any
  // rows (no orphaned active faculty without a stored credential).
  const secret = seal(temporaryPassword);
  const passwordHash = await hashPassword(temporaryPassword);
  const code = await nextUserCode(new Date().getUTCFullYear());

  const user = await User.create({
    role: 'faculty',
    code,
    name: input.name.trim(),
    email,
    phoneE164: input.phoneE164.trim(),
    status: 'active',
    passwordHash,
    passwordUpdatedAt: new Date(),
  });
  try {
    await FacultyCredential.create({ userId: user._id, secret });
  } catch (err) {
    // Compensate: never leave an active faculty with no stored credential
    // (the two writes aren't transactional). Roll the user back and rethrow.
    await User.deleteOne({ _id: user._id }).catch(() => undefined);
    throw err;
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
  return { user, temporaryPassword };
}

/**
 * Generate a fresh password for an existing faculty, re-store it encrypted,
 * and invalidate their existing sessions. Returns the new plaintext.
 */
export async function resetFacultyPassword(
  id: string,
  actor: Actor,
): Promise<{ temporaryPassword: string }> {
  assertAdmin(actor.role);
  const oid = requireId(id);
  const user = await User.findOne({ _id: oid, deletedAt: null });
  if (!user || user.role !== 'faculty') {
    throw new HttpError(404, 'NOT_FOUND', 'Faculty not found.');
  }

  const before = scrubUser(user.toObject());
  const temporaryPassword = generatePassword();
  validatePolicy(temporaryPassword);
  const secret = seal(temporaryPassword);
  const passwordHash = await hashPassword(temporaryPassword);

  // Store the new sealed secret BEFORE flipping the hash. If the hash save
  // then fails (transient error), the faculty can still log in with the old
  // password (not locked out) and a retry re-syncs — the safer divergence
  // than the table showing a password that no longer authenticates.
  await FacultyCredential.findOneAndUpdate(
    { userId: user._id },
    { secret },
    { upsert: true, new: true },
  );
  user.passwordHash = passwordHash;
  user.passwordUpdatedAt = new Date();
  // A faculty that never accepted their invite becomes usable now.
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

/** All faculty with their (decrypted) stored password + course-assignment count. */
export async function listFacultyAccounts(actor: Actor): Promise<FacultyAccountDto[]> {
  // Self-protect the sensitive decrypt path (matches create/reset) so it can
  // never leak every faculty's password if a future caller forgets the gate.
  assertAdmin(actor.role);
  const users = await User.find({ role: 'faculty', deletedAt: null }).sort({ createdAt: -1 });
  const ids = users.map((u) => u._id);

  const creds = await FacultyCredential.find({ userId: { $in: ids } });
  const secretByUser = new Map(creds.map((c) => [String(c.userId), c.secret]));

  const counts = await Course.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { facultyIds: { $in: ids }, deletedAt: null } },
    { $unwind: '$facultyIds' },
    { $match: { facultyIds: { $in: ids } } },
    { $group: { _id: '$facultyIds', n: { $sum: 1 } } },
  ]);
  const countByUser = new Map(counts.map((r) => [String(r._id), r.n]));

  return users.map((u) => {
    const sealed = secretByUser.get(String(u._id));
    let password: string | null = null;
    if (sealed) {
      // If the key is unset/rotated, degrade to null rather than failing the list.
      try {
        password = open(sealed);
      } catch {
        password = null;
      }
    }
    return toFacultyAccountDto(u, password, countByUser.get(String(u._id)) ?? 0);
  });
}
