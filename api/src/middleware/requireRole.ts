import type { NextFunction, Request, Response } from 'express';
import type { Role } from 'india-learns-shared-types';
import { HttpError } from './error.js';

export function requireRole(...roles: Role[]) {
  const allowed = new Set(roles);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { auth } = req;
    if (!auth) {
      next(new HttpError(401, 'UNAUTHENTICATED', 'Authentication required.'));
      return;
    }
    if (!allowed.has(auth.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'Role not permitted.'));
      return;
    }
    next();
  };
}
