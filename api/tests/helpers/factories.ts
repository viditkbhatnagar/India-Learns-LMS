import type { Role } from 'india-learns-shared-types';
import { User, type UserDoc } from '../../src/models/index.js';
import { hashPassword } from '../../src/services/passwordService.js';

export interface MakeUserInput {
  role?: Role;
  email?: string;
  name?: string;
  phoneE164?: string;
  password?: string;
  status?: UserDoc['status'];
  code?: string | null;
}

let counter = 0;

export async function makeUser(input: MakeUserInput = {}): Promise<UserDoc> {
  counter += 1;
  const role = input.role ?? 'student';
  const email = input.email ?? `u${counter}-${Date.now()}@test.local`;
  const doc = await User.create({
    role,
    code: input.code ?? null,
    name: input.name ?? `User ${counter}`,
    email,
    phoneE164: input.phoneE164 ?? `+9199900${String(counter).padStart(5, '0')}`,
    status: input.status ?? 'active',
    passwordHash: input.password ? await hashPassword(input.password) : null,
    passwordUpdatedAt: input.password ? new Date() : null,
  });
  return doc;
}

export async function makeAdmin(password = 'Admin#12345'): Promise<{ user: UserDoc; password: string }> {
  const user = await makeUser({
    role: 'admin',
    email: `admin-${Date.now()}-${Math.random()}@test.local`,
    password,
    status: 'active',
    name: 'Admin User',
  });
  return { user, password };
}
