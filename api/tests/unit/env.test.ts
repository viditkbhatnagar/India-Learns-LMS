import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv, resetEnvCache } from '../../src/config/env.js';

const SNAPSHOT_KEYS = ['NODE_ENV', 'JWT_SECRET', 'JOB_SECRET'] as const;

describe('loadEnv production guards', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of SNAPSHOT_KEYS) {
      snapshot[k] = process.env[k];
    }
    resetEnvCache();
  });

  afterEach(() => {
    for (const k of SNAPSHOT_KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
    resetEnvCache();
  });

  it('refuses the dev default JWT_SECRET when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me-dev-only';
    process.env.JOB_SECRET = 'x'.repeat(64);
    expect(() => loadEnv()).toThrow(/Insecure production configuration/);
  });

  it('refuses the dev default JOB_SECRET when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'x'.repeat(64);
    process.env.JOB_SECRET = 'change-me';
    expect(() => loadEnv()).toThrow(/Insecure production configuration/);
  });

  it('refuses short secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'too-short';
    process.env.JOB_SECRET = 'x'.repeat(64);
    expect(() => loadEnv()).toThrow(/Insecure production configuration/);
  });

  it('accepts strong secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.JOB_SECRET = 'b'.repeat(64);
    expect(() => loadEnv()).not.toThrow();
  });

  it('leaves dev/test environments untouched', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'change-me-dev-only';
    process.env.JOB_SECRET = 'change-me-dev-only';
    expect(() => loadEnv()).not.toThrow();
  });
});
