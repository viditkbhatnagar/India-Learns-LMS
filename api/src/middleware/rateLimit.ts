import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { loadEnv } from '../config/env.js';

function clientKey(req: Request): string {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `${ip}:${email}`;
}

function passthrough(): RequestHandler {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export function buildLoginLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: env.LOGIN_RATE_WINDOW_MIN * 60_000,
    max: env.LOGIN_RATE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: clientKey,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts — try again shortly.',
        },
      });
    },
  }) as unknown as RequestHandler;
}

export function buildPasswordResetLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: env.PASSWORD_RESET_RATE_WINDOW_MIN * 60_000,
    max: env.PASSWORD_RESET_RATE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many password reset requests — try again later.',
        },
      });
    },
  }) as unknown as RequestHandler;
}

// M10u — Public visitor-lead self-registration limiter (per-IP, 5/hr).
// Prevents abuse of the unauthenticated /v1/public/visitor-register
// endpoint. Same env switch as login + password-reset.
export function buildPublicVisitorLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: 60 * 60_000, // 1 hour
    max: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many lead submissions from this network — try again later.',
        },
      });
    },
  }) as unknown as RequestHandler;
}

// Entrance-exam candidate login limiter. Keyed by phone+IP (the entrance login
// authenticates by phone, not email). Same env switch and limits as the main
// login limiter so brute-forcing a candidate password is bounded.
export function buildEntranceLoginLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: env.LOGIN_RATE_WINDOW_MIN * 60_000,
    max: env.LOGIN_RATE_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const phone =
        typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D/g, '') : '';
      const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      return `${ip}:${phone}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts — try again shortly.',
        },
      });
    },
  }) as unknown as RequestHandler;
}

// Slide import (.pptx) limiter — authenticated staff endpoint. Parsing a
// PowerPoint is CPU/memory-bound (server-side unzip + XML scan), so cap each
// user to blunt abuse from a compromised account. Keyed by user id, with an
// IP fallback. Same RATE_LIMITS_DISABLED switch as the other limiters.
/**
 * Lesson-plan .docx upload — each request can carry a 15 MB archive that gets
 * inflated + regex-scanned, so cap it tighter than the pptx path.
 */
export function buildLessonPlanImportLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId?.toString() ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many lesson-plan uploads — try again in a minute.',
        },
      });
    },
  });
}

export function buildPptxImportLimiter(): RequestHandler {
  const env = loadEnv();
  if (env.RATE_LIMITS_DISABLED) return passthrough();
  return rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId?.toString() ?? req.ip ?? 'unknown',
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many slide imports — try again shortly.',
        },
      });
    },
  }) as unknown as RequestHandler;
}

// Re-export for tests or consumers who want the specific type:
export type { RateLimitRequestHandler };
