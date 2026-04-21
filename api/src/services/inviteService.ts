import type { Types } from 'mongoose';
import type { InviteTokenKind } from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { InviteToken, type InviteTokenDoc } from '../models/index.js';
import { generateOpaqueToken, sha256 } from './tokenService.js';

export interface IssuedInviteToken {
  plain: string;
  record: InviteTokenDoc;
}

function ttlForKind(kind: InviteTokenKind): number {
  const env = loadEnv();
  if (kind === 'invite') return env.INVITE_TOKEN_TTL_DAYS * 86_400_000;
  return env.RESET_TOKEN_TTL_MIN * 60_000;
}

export async function createInviteToken(
  userId: Types.ObjectId,
  kind: InviteTokenKind,
): Promise<IssuedInviteToken> {
  await InviteToken.updateMany(
    { userId, kind, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  const { plain, tokenHash } = generateOpaqueToken();
  const record = await InviteToken.create({
    userId,
    tokenHash,
    kind,
    expiresAt: new Date(Date.now() + ttlForKind(kind)),
    usedAt: null,
  });
  return { plain, record };
}

export async function consumeInviteToken(
  plain: string,
  kind: InviteTokenKind,
): Promise<InviteTokenDoc> {
  if (!plain) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing token.');
  }
  const tokenHash = sha256(plain);
  const record = await InviteToken.findOne({ tokenHash, kind });
  if (!record) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Token is invalid or expired.');
  }
  if (record.usedAt) {
    throw new HttpError(410, 'TOKEN_USED', 'Token already used.');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Token expired.');
  }
  const updated = await InviteToken.findOneAndUpdate(
    { _id: record._id, usedAt: null },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!updated) {
    throw new HttpError(410, 'TOKEN_USED', 'Token already used.');
  }
  return updated;
}
