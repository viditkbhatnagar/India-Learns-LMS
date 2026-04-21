import argon2 from 'argon2';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import type { UserDoc } from '../models/index.js';

const MIN_LENGTH = 10;

export function validatePolicy(plain: string): void {
  if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Password must be at least ${MIN_LENGTH} characters long.`,
    );
  }
  if (!/[A-Za-z]/.test(plain) || !/\d/.test(plain)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Password must include at least one letter and one digit.',
    );
  }
}

export async function hashPassword(plain: string): Promise<string> {
  const env = loadEnv();
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: env.ARGON2_TIME_COST,
    memoryCost: env.ARGON2_MEMORY_COST,
    parallelism: env.ARGON2_PARALLELISM,
  });
}

export async function verifyPassword(
  hash: string | null | undefined,
  plain: string,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function assertNotReused(
  user: Pick<UserDoc, 'passwordHash' | 'passwordHistoryHashes'>,
  plain: string,
): Promise<void> {
  const candidates = [
    ...(user.passwordHash ? [user.passwordHash] : []),
    ...(user.passwordHistoryHashes ?? []),
  ];
  for (const candidate of candidates) {
    if (await verifyPassword(candidate, plain)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'Password must differ from your last three passwords.',
      );
    }
  }
}

export function rotateHistory(current: string[], previous: string | null): string[] {
  const next = previous ? [previous, ...current] : [...current];
  return next.slice(0, 3);
}
