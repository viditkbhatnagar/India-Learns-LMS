import * as Sentry from '@sentry/node';
import { loadEnv } from './env.js';

let initialized = false;

/**
 * Initialise Sentry for the API process. No-op when SENTRY_DSN is empty so
 * dev/test environments require no extra configuration. Safe to call multiple
 * times — only the first call wires the SDK.
 */
export function initSentry(): boolean {
  if (initialized) return true;
  const env = loadEnv();
  if (!env.SENTRY_DSN) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
    release: env.GIT_SHA !== 'dev' ? env.GIT_SHA : undefined,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  initialized = true;
  return true;
}

/**
 * Capture an exception. No-op when Sentry was never initialised (DSN absent).
 * Errors with HTTP status < 500 are filtered out — they're operator-meaningful
 * but not bug signals.
 */
export function captureException(
  err: unknown,
  context?: { requestId?: string; userId?: string; route?: string },
): void {
  if (!initialized) return;
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status: unknown }).status)
      : 500;
  if (status < 500) return;
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('requestId', context.requestId);
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.route) scope.setTag('route', context.route);
    Sentry.captureException(err);
  });
}

/** Test-only — drop the initialised flag so subsequent tests can re-init. */
export function resetSentryForTests(): void {
  initialized = false;
}
