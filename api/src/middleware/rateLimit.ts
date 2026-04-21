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

// Re-export for tests or consumers who want the specific type:
export type { RateLimitRequestHandler };
