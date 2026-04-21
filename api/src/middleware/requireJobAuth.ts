import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { loadEnv } from '../config/env.js';
import { HttpError } from './error.js';

// TRD §10 / §14 — cron endpoints are protected by an HMAC-SHA256 signature
// over the raw request body + a timestamp header. Replays are rejected after
// a 5-minute window.

const REPLAY_WINDOW_SEC = 300;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function requireJobAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const env = loadEnv();
    const signature = req.header('x-job-signature') ?? '';
    const timestamp = req.header('x-job-timestamp') ?? '';
    if (!signature || !timestamp) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Missing job auth headers.');
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid timestamp.');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > REPLAY_WINDOW_SEC) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Timestamp outside replay window.');
    }

    // Use the request's raw body if captured; otherwise JSON.stringify the parsed body.
    const rawBody =
      (req as Request & { rawBody?: Buffer | string }).rawBody?.toString() ??
      JSON.stringify(req.body ?? {});

    const payload = `${rawBody}${timestamp}`;
    const expected = crypto
      .createHmac('sha256', env.JOB_SECRET)
      .update(payload)
      .digest('hex');

    if (!timingSafeEqualHex(expected, signature)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid signature.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function signJobRequest(
  body: unknown,
  timestampSec: number = Math.floor(Date.now() / 1000),
  secret?: string,
): { signature: string; timestamp: string } {
  const env = secret ? { JOB_SECRET: secret } : loadEnv();
  const raw = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const signature = crypto
    .createHmac('sha256', env.JOB_SECRET)
    .update(`${raw}${timestampSec}`)
    .digest('hex');
  return { signature, timestamp: String(timestampSec) };
}
