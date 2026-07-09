import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { EntranceCandidate } from '../models/index.js';
import { verifyEntranceToken } from '../services/entrance/entranceToken.js';
import { HttpError } from './error.js';

export interface EntranceAuthContext {
  candidateId: Types.ObjectId;
  examId: Types.ObjectId;
}

declare module 'http' {
  interface IncomingMessage {
    entranceAuth?: EntranceAuthContext;
  }
}

function readBearer(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Gate for `/v1/entrance/me/*`. Verifies an entrance-audience token and loads
 * the candidate from the isolated EntranceCandidate collection. Entirely
 * separate from `requireAuth` — no `User`, no role, no course access.
 */
export async function requireEntranceCandidate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readBearer(req);
    if (!token) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing bearer token.');
    }
    const claims = await verifyEntranceToken(token);
    const candidate = await EntranceCandidate.findById(claims.sub);
    if (!candidate || !candidate.active) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Entrance session no longer valid.');
    }
    req.entranceAuth = { candidateId: candidate._id, examId: candidate.examId };
    next();
  } catch (err) {
    next(err);
  }
}
