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

// PRD §9.5 + D-021: fees-suspended students keep a live session but can only
// hit a whitelist of routes. Manual-suspended users are hard-blocked upstream.
function feesSuspensionAllowed(req: Request): boolean {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url;
  if (method === 'GET' && /\/students\/me\/fees(?:$|\?)/.test(url)) return true;
  if (method === 'GET' && /\/students\/me\/dashboard(?:$|\?)/.test(url)) return true;
  if (method === 'GET' && /\/users\/me(?:$|\?)/.test(url)) return true;
  if (method === 'POST' && /\/auth\/logout(?:$|\?)/.test(url)) return true;
  if (method === 'POST' && /\/auth\/refresh(?:$|\?)/.test(url)) return true;
  // Notification list/read stays allowed so students see the suspension-notice.
  if (/\/notifications\/me/.test(url)) return true;
  // PRD §9.5 / D-052: fees-suspended students can raise a Finance-category
  // ticket and read their own ticket thread so they can negotiate payment.
  if (method === 'POST' && /\/tickets\/?(?:$|\?)/.test(url)) {
    const body = req.body as { category?: string } | undefined;
    if (body?.category === 'finance') return true;
  }
  if (method === 'GET' && /\/me\/tickets(?:$|\?|\/)/.test(url)) return true;
  if (method === 'GET' && /\/tickets\/me(?:$|\?|\/)/.test(url)) return true;
  if (method === 'GET' && /\/tickets\/[^/]+(?:$|\?)/.test(url)) return true;
  if (method === 'POST' && /\/tickets\/[^/]+\/comments(?:$|\?)/.test(url)) return true;
  if (method === 'POST' && /\/tickets\/[^/]+\/reopen-request(?:$|\?)/.test(url)) return true;
  // Admin + finance recording a payment for this student must succeed even if
  // the acting admin impersonates them; payments router enforces role gates.
  if (method === 'POST' && /\/payments\/?(?:$|\?)/.test(url)) return true;
  // Receipt download for the student's own receipts stays allowed.
  if (method === 'GET' && /\/receipts\/[^/]+\/download(?:$|\?)/.test(url)) return true;
  return false;
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
      throw new HttpError(403, 'SUSPENDED_ACCESS', 'Account suspended.');
    }
    if (user.status === 'pending') {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Invitation not completed.');
    }
    if (user.status === 'suspended' && user.suspensionKind === 'fees') {
      if (!feesSuspensionAllowed(req)) {
        throw new HttpError(
          403,
          'FEES_SUSPENDED',
          'Access suspended due to unpaid fees. Visit your Fees page or raise a Finance ticket.',
        );
      }
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
