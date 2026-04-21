import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import type { Role, UserStatus } from 'india-learns-shared-types';
import { User, type HydratedUser } from '../models/index.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { HttpError } from './error.js';

export interface AuthContext {
  userId: Types.ObjectId;
  role: Role;
  status: UserStatus;
  user: HydratedUser;
}

declare module 'http' {
  interface IncomingMessage {
    auth?: AuthContext;
  }
}

function readBearer(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/.exec(header.trim());
  return match?.[1] ?? null;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readBearer(req);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing bearer token.');
    }
    const claims = await verifyAccessToken(token);
    const user = await User.findById(claims.sub);
    if (!user || user.deletedAt || user.status === 'revoked') {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Session no longer valid.');
    }
    if (user.status === 'suspended' && user.suspensionKind === 'manual') {
      // Fees-suspended users keep a valid session; M5 page-level middleware
      // restricts them to /fees, /profile, and Finance tickets (PRD §9.5).
      throw new HttpError(403, 'SUSPENDED_ACCESS', 'Account suspended.');
    }
    if (user.status === 'pending') {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Invitation not completed.');
    }
    req.auth = {
      userId: user._id,
      role: user.role,
      status: user.status,
      user,
    };
    next();
  } catch (err) {
    next(err);
  }
}
