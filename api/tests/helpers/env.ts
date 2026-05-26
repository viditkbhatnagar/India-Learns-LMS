import { beforeAll } from 'vitest';
import { resetEnvCache } from '../../src/config/env.js';

const DEFAULTS: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret-32b!',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '14d',
  JOB_SECRET: 'test-job-secret',
  WEB_ORIGIN: 'http://localhost:5173',
  API_ORIGIN: 'http://localhost:4000',
  COOKIE_DOMAIN: 'localhost',
  COOKIE_SECURE: 'false',
  INTEGRATIONS_MODE: 'stub',
  // Storage is decoupled from INTEGRATIONS_MODE — pin it explicitly so the
  // test suite always sees the in-memory ConsoleStorageAdapter regardless
  // of the production default.
  STORAGE_PROVIDER: 'stub',
  EMAIL_PROVIDER: 'stub',
  WHATSAPP_ENABLED: 'false',
  ARGON2_TIME_COST: '2',
  ARGON2_MEMORY_COST: '4096',
  ARGON2_PARALLELISM: '1',
  INVITE_TOKEN_TTL_DAYS: '7',
  RESET_TOKEN_TTL_MIN: '30',
  SESSION_CAP: '5',
  LOGIN_RATE_MAX: '5',
  LOGIN_RATE_WINDOW_MIN: '15',
  LOGIN_LOCK_AFTER: '10',
  LOGIN_LOCK_DURATION_MIN: '30',
  PASSWORD_RESET_RATE_MAX: '3',
  PASSWORD_RESET_RATE_WINDOW_MIN: '60',
  RATE_LIMITS_DISABLED: 'true',
  LOG_LEVEL: 'silent',
  GIT_SHA: 'test',
};

export function seedTestEnv(): void {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (!process.env[k]) process.env[k] = v;
  }
  resetEnvCache();
}

export function useTestEnv(): void {
  beforeAll(() => {
    seedTestEnv();
  });
}

// Seed as soon as the helpers module loads — any test that imports env-sensitive
// code before its beforeAll gets sane defaults.
seedTestEnv();
