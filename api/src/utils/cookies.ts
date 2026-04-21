import type { CookieOptions } from 'express';
import { loadEnv } from '../config/env.js';
import { parseTtl } from './time.js';

export const REFRESH_COOKIE_NAME = '__Host-il_rt';
export const REFRESH_COOKIE_PATH = '/';

/**
 * RFC 6265bis requires `__Host-`-prefixed cookies to set `Path=/` and omit the
 * `Domain` attribute, so browsers drop the cookie if Path is narrower. TRD §7
 * text specifies `Path=/v1/auth/refresh`; TRD §11 requires the `__Host-`
 * prefix. Enforcing both is impossible — we keep the stronger `__Host-`
 * guarantee and widen Path to `/`. Server-side scope: route-level middleware
 * gates where the cookie is read (only refresh/logout).
 * See Q-M2-04 in memory/open-questions.md.
 */
export function refreshCookieOptions(): CookieOptions {
  const env = loadEnv();
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: parseTtl(env.JWT_REFRESH_TTL),
  };
}

export function clearedRefreshCookieOptions(): CookieOptions {
  const base = refreshCookieOptions();
  return { ...base, maxAge: 0 };
}
