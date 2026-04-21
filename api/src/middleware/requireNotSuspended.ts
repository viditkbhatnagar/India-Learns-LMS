import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.js';

// D-021 + PRD §9.5 — fees-suspended users keep a live session and can see
// /v1/students/me/fees, /v1/users/me, and post a Finance-category ticket.
// Every other route should return 403 FEES_SUSPENDED until the balance clears
// or an admin applies an override.

function isWhitelisted(req: Request): boolean {
  const { path } = req;
  const method = req.method.toUpperCase();
  // Allow the fees self-view regardless of the mount prefix.
  if (method === 'GET' && /\/students\/me\/fees$/.test(path)) return true;
  if (method === 'GET' && /\/users\/me$/.test(path)) return true;
  if (method === 'POST' && /\/auth\/logout$/.test(path)) return true;
  if (method === 'POST' && /\/auth\/refresh$/.test(path)) return true;
  // Allow finance-category ticket creation (route lands in M6). Until then,
  // everything else under /tickets is blocked as expected.
  if (method === 'POST' && /\/tickets\/?$/.test(path)) {
    const body = req.body as { category?: string } | undefined;
    if (body?.category === 'Finance') return true;
  }
  // Allow recording a payment so finance staff can clear a suspension even
  // while acting under a suspended session of their own student page.
  if (method === 'POST' && /\/payments\/?$/.test(path)) return true;
  return false;
}

export function requireNotSuspended(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const { auth } = req;
  if (!auth) {
    next();
    return;
  }
  const { user } = auth;
  if (user.status !== 'suspended') {
    next();
    return;
  }
  if (user.suspensionKind === 'manual') {
    // Hard block — already caught by requireAuth, but belt-and-braces.
    next(new HttpError(403, 'SUSPENDED_ACCESS', 'Account suspended.'));
    return;
  }
  if (user.suspensionKind === 'fees') {
    if (isWhitelisted(req)) {
      next();
      return;
    }
    next(
      new HttpError(
        403,
        'FEES_SUSPENDED',
        'Access suspended due to unpaid fees. Visit /fees or raise a Finance ticket.',
      ),
    );
    return;
  }
  next();
}
