import type { Types } from 'mongoose';
import type { AuthTokensResponse } from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { User, type HydratedUser } from '../models/index.js';
import { recordAudit, scrubUser } from './auditService.js';
import { consumeInviteToken, createInviteToken } from './inviteService.js';
import {
  assertNotReused,
  hashPassword,
  rotateHistory,
  validatePolicy,
  verifyPassword,
} from './passwordService.js';
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from './refreshTokenService.js';
import { signAccessToken } from './tokenService.js';
import { findUserByEmail, toUserDto } from './userService.js';
import { getIntegrations } from '../integrations/index.js';

export interface RequestContext {
  ip: string;
  ua: string;
  deviceId: string;
}

export interface TokenPair {
  response: AuthTokensResponse;
  refreshToken: string;
}

async function issueTokens(user: HydratedUser, ctx: RequestContext): Promise<TokenPair> {
  const { token, expiresIn } = await signAccessToken(user);
  const issued = await issueRefreshToken(user, ctx);
  return {
    response: {
      user: toUserDto(user),
      accessToken: token,
      accessTokenExpiresIn: expiresIn,
    },
    refreshToken: issued.plain,
  };
}

export async function login(
  email: string,
  password: string,
  ctx: RequestContext,
): Promise<TokenPair> {
  const user = await findUserByEmail(email);
  if (!user || user.deletedAt || user.status === 'revoked') {
    await recordAudit({
      actorUserId: null,
      action: 'auth.login.failure',
      targetType: 'User',
      targetId: user?._id ?? null,
      details: { email, reason: 'unknown_user' },
      ip: ctx.ip,
      ua: ctx.ua,
    });
    throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid email or password.');
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAudit({
      actorUserId: null,
      action: 'auth.login.failure',
      targetType: 'User',
      targetId: user._id,
      details: { email, reason: 'locked' },
      ip: ctx.ip,
      ua: ctx.ua,
    });
    throw new HttpError(401, 'UNAUTHENTICATED', 'Account temporarily locked.');
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const env = loadEnv();
    // Atomic $inc so concurrent bad-password attempts can't lose increments.
    const bumped = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { loginFailCount: 1 } },
      { new: true },
    );
    if (bumped && bumped.loginFailCount >= env.LOGIN_LOCK_AFTER) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            lockedUntil: new Date(Date.now() + env.LOGIN_LOCK_DURATION_MIN * 60_000),
            loginFailCount: 0,
          },
        },
      );
    }
    await recordAudit({
      actorUserId: null,
      action: 'auth.login.failure',
      targetType: 'User',
      targetId: user._id,
      details: { email, reason: 'bad_password' },
      ip: ctx.ip,
      ua: ctx.ua,
    });
    throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid email or password.');
  }
  if (user.status === 'pending') {
    throw new HttpError(
      401,
      'UNAUTHENTICATED',
      'Complete your invitation before signing in.',
    );
  }
  if (user.status === 'suspended' && user.suspensionKind === 'manual') {
    // PRD §3.2 / §9.5: manual suspension blocks login entirely; fees-suspended
    // users may still log in to access /fees, /profile, and Finance tickets.
    await recordAudit({
      actorUserId: null,
      action: 'auth.login.failure',
      targetType: 'User',
      targetId: user._id,
      details: { email, reason: 'suspended_manual' },
      ip: ctx.ip,
      ua: ctx.ua,
    });
    throw new HttpError(403, 'SUSPENDED_ACCESS', 'Access suspended by admin.');
  }
  user.loginFailCount = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
  const pair = await issueTokens(user, ctx);
  await recordAudit({
    actorUserId: user._id,
    action: 'auth.login.success',
    targetType: 'User',
    targetId: user._id,
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return pair;
}

export async function acceptInvite(
  token: string,
  password: string,
  ctx: RequestContext,
): Promise<TokenPair> {
  validatePolicy(password);
  const record = await consumeInviteToken(token, 'invite');
  const user = await User.findById(record.userId);
  if (!user || user.deletedAt || user.status === 'revoked') {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Invite no longer valid.');
  }
  user.passwordHash = await hashPassword(password);
  user.passwordUpdatedAt = new Date();
  user.passwordHistoryHashes = [];
  user.status = 'active';
  user.lastLoginAt = new Date();
  user.loginFailCount = 0;
  user.lockedUntil = null;
  await user.save();
  const pair = await issueTokens(user, ctx);
  await recordAudit({
    actorUserId: user._id,
    action: 'auth.invite_accepted',
    targetType: 'User',
    targetId: user._id,
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return pair;
}

export async function refresh(
  presentedRefresh: string,
  ctx: RequestContext,
): Promise<TokenPair> {
  const rotated = await rotateRefreshToken(presentedRefresh, ctx);
  const user = await User.findById(rotated.userId);
  if (!user || user.deletedAt || user.status === 'revoked') {
    await revokeAllForUser(rotated.userId);
    throw new HttpError(401, 'UNAUTHENTICATED', 'User is no longer active.');
  }
  if (user.status === 'suspended' && user.suspensionKind === 'manual') {
    throw new HttpError(403, 'SUSPENDED_ACCESS', 'Account suspended.');
  }
  const { token, expiresIn } = await signAccessToken(user);
  return {
    response: {
      user: toUserDto(user),
      accessToken: token,
      accessTokenExpiresIn: expiresIn,
    },
    refreshToken: rotated.plain,
  };
}

export async function logout(
  presentedRefresh: string | undefined,
  user: { _id: Types.ObjectId } | null,
  ctx: RequestContext,
): Promise<void> {
  if (presentedRefresh) await revokeRefreshToken(presentedRefresh);
  if (user) {
    await recordAudit({
      actorUserId: user._id,
      action: 'auth.logout',
      targetType: 'User',
      targetId: user._id,
      ip: ctx.ip,
      ua: ctx.ua,
    });
  }
}

export async function requestPasswordReset(
  email: string,
  ctx: { ip: string; ua: string },
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await findUserByEmail(normalized);
  await recordAudit({
    actorUserId: null,
    action: 'auth.password_reset_requested',
    targetType: 'User',
    targetId: user?._id ?? null,
    details: { email: normalized, found: Boolean(user) },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  if (!user || user.deletedAt || user.status === 'revoked') return;
  const { plain } = await createInviteToken(user._id, 'reset');
  const env = loadEnv();
  const link = `${env.WEB_ORIGIN.replace(/\/$/, '')}/reset-password?t=${encodeURIComponent(plain)}`;
  const { email: mailer } = getIntegrations();
  await mailer.send({
    to: user.email,
    subject: 'Reset your India Learns password',
    html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. It expires in 30 minutes.</p><p><a href="${link}">${link}</a></p>`,
    text: `Hi ${user.name},\n\nUse this link to reset your password (expires in 30 minutes):\n${link}\n`,
    tag: 'password-reset',
    vars: { name: user.name, resetUrl: link },
  });
}

export async function confirmPasswordReset(
  token: string,
  password: string,
  ctx: RequestContext,
): Promise<HydratedUser> {
  validatePolicy(password);
  const record = await consumeInviteToken(token, 'reset');
  const user = await User.findById(record.userId);
  if (!user || user.deletedAt || user.status === 'revoked') {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Reset link no longer valid.');
  }
  await assertNotReused(user, password);
  const before = scrubUser(user.toObject());
  user.passwordHistoryHashes = rotateHistory(
    user.passwordHistoryHashes ?? [],
    user.passwordHash,
  );
  user.passwordHash = await hashPassword(password);
  user.passwordUpdatedAt = new Date();
  user.lockedUntil = null;
  user.loginFailCount = 0;
  if (user.status === 'pending') user.status = 'active';
  await user.save();
  await revokeAllForUser(user._id);
  await recordAudit({
    actorUserId: user._id,
    action: 'auth.password_reset_confirmed',
    targetType: 'User',
    targetId: user._id,
    before,
    after: scrubUser(user.toObject()),
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return user;
}

export async function changePassword(
  user: HydratedUser,
  current: string,
  next: string,
  ctx: RequestContext,
): Promise<void> {
  const ok = await verifyPassword(user.passwordHash, current);
  if (!ok) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Current password is incorrect.');
  }
  validatePolicy(next);
  await assertNotReused(user, next);
  const before = scrubUser(user.toObject());
  user.passwordHistoryHashes = rotateHistory(
    user.passwordHistoryHashes ?? [],
    user.passwordHash,
  );
  user.passwordHash = await hashPassword(next);
  user.passwordUpdatedAt = new Date();
  await user.save();
  await revokeAllForUser(user._id);
  await recordAudit({
    actorUserId: user._id,
    action: 'auth.password_changed',
    targetType: 'User',
    targetId: user._id,
    before,
    after: scrubUser(user.toObject()),
    ip: ctx.ip,
    ua: ctx.ua,
  });
}
