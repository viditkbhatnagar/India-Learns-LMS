import * as Sentry from '@sentry/react';

let initialized = false;

/**
 * Initialise Sentry for the web app. No-op when VITE_SENTRY_DSN is empty so
 * dev requires no extra configuration. Safe to call multiple times.
 */
export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: (import.meta.env.MODE as string) || 'development',
    release: (import.meta.env.VITE_GIT_SHA as string) || undefined,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
  initialized = true;
  return true;
}

export function captureException(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}
