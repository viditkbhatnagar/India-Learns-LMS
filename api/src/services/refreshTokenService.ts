import { Types } from 'mongoose';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { RefreshToken, type RefreshTokenDoc, type UserDoc } from '../models/index.js';
import { parseTtl } from '../utils/time.js';
import { generateOpaqueToken, sha256 } from './tokenService.js';

export interface IssueContext {
  deviceId: string;
  ua: string;
  ip: string;
}

export interface IssuedRefresh {
  plain: string;
  record: RefreshTokenDoc;
}

function refreshTtlMs(): number {
  return parseTtl(loadEnv().JWT_REFRESH_TTL);
}

function expiryDate(): Date {
  return new Date(Date.now() + refreshTtlMs());
}

async function evictOldest(userId: Types.ObjectId, cap: number): Promise<void> {
  const active = await RefreshToken.find({
    userId,
    revokedAt: null,
  })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();
  if (active.length <= cap) return;
  const surplus = active.slice(cap).map((d) => d._id);
  await RefreshToken.updateMany(
    { _id: { $in: surplus } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function issueRefreshToken(
  user: Pick<UserDoc, '_id' | 'sessionCap'>,
  ctx: IssueContext,
): Promise<IssuedRefresh> {
  const env = loadEnv();
  const cap = user.sessionCap ?? env.SESSION_CAP;
  const { plain, tokenHash } = generateOpaqueToken();
  const familyId = new Types.ObjectId();
  const record = await RefreshToken.create({
    userId: user._id,
    familyId,
    tokenHash,
    deviceId: ctx.deviceId,
    ua: ctx.ua,
    ip: ctx.ip,
    expiresAt: expiryDate(),
    revokedAt: null,
    rotatedFromId: null,
    rotatedToId: null,
  });
  await evictOldest(user._id, cap);
  return { plain, record };
}

export async function rotateRefreshToken(
  presentedPlain: string,
  ctx: IssueContext,
): Promise<{ userId: Types.ObjectId; plain: string; record: RefreshTokenDoc }> {
  if (!presentedPlain) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Missing refresh token.');
  }
  const presentedHash = sha256(presentedPlain);

  // Atomic claim: only one concurrent request wins this update. Losers either
  // see `revokedAt` already set (reuse branch below) or find no doc (unknown
  // or already-rotated).
  const existing = await RefreshToken.findOneAndUpdate(
    { tokenHash: presentedHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: false },
  );

  if (!existing) {
    // Either the token doesn't exist at all, or it was already revoked —
    // second case is the reuse scenario. Discriminate to decide blast radius.
    const stale = await RefreshToken.findOne({ tokenHash: presentedHash });
    if (!stale) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Unknown refresh token.');
    }
    await RefreshToken.updateMany(
      { familyId: stale.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new HttpError(
      401,
      'UNAUTHENTICATED',
      'Refresh token reused — session revoked.',
    );
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Refresh token expired.');
  }

  const { plain, tokenHash } = generateOpaqueToken();
  const fresh = await RefreshToken.create({
    userId: existing.userId,
    familyId: existing.familyId,
    tokenHash,
    deviceId: ctx.deviceId || existing.deviceId,
    ua: ctx.ua || existing.ua,
    ip: ctx.ip || existing.ip,
    expiresAt: expiryDate(),
    revokedAt: null,
    rotatedFromId: existing._id,
    rotatedToId: null,
  });
  await RefreshToken.updateOne(
    { _id: existing._id },
    { $set: { rotatedToId: fresh._id } },
  );
  return { userId: existing.userId, plain, record: fresh };
}

export async function revokeRefreshToken(presentedPlain: string): Promise<void> {
  if (!presentedPlain) return;
  const tokenHash = sha256(presentedPlain);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllForUser(userId: Types.ObjectId): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
