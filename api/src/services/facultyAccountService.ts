import type { Types } from 'mongoose';
import type { CreateFacultyInput, FacultyAccountDto, Role } from 'india-learns-shared-types';
import {
  Course,
  FacultyCredential,
  User,
  type HydratedUser,
} from '../models/index.js';
import type { ActorContext } from './userService.js';
import { open } from '../utils/secretBox.js';
import { assertAdmin, createUserAccount, resetUserPassword } from './userAccountService.js';

// Faculty-facing wrappers over the generalized userAccountService — the
// /admin/faculty page + /v1/faculty routes. Faculty credentials are the same
// encrypted store (`facultycredentials`) as every other role; this adds the
// course-assignment count faculty-specific listing needs.

type Actor = { role: Role } & ActorContext;

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

export async function createFacultyAccount(
  input: CreateFacultyInput,
  actor: Actor,
): Promise<{ user: HydratedUser; temporaryPassword: string }> {
  const { user, temporaryPassword } = await createUserAccount({ ...input, role: 'faculty' }, actor);
  return { user, temporaryPassword };
}

export async function resetFacultyPassword(
  id: string,
  actor: Actor,
): Promise<{ temporaryPassword: string }> {
  return resetUserPassword(id, actor);
}

/** All faculty with their (decrypted) stored password + course-assignment count. */
export async function listFacultyAccounts(actor: Actor): Promise<FacultyAccountDto[]> {
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
      try {
        password = open(sealed);
      } catch {
        password = null;
      }
    }
    return toFacultyAccountDto(u, password, countByUser.get(String(u._id)) ?? 0);
  });
}
