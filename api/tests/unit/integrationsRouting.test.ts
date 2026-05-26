import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { resetEnvCache } from '../../src/config/env.js';
import {
  getIntegrations,
  resetIntegrationsCache,
  setIntegrations,
} from '../../src/integrations/index.js';
import { ConsoleStorageAdapter } from '../../src/integrations/storageAdapter.js';
import { S3StorageAdapter } from '../../src/integrations/s3StorageAdapter.js';
import { MongoStorageAdapter } from '../../src/integrations/mongoStorageAdapter.js';

// Storage is the only integration that is selected independently of the
// master INTEGRATIONS_MODE switch — see api/src/integrations/index.ts.
// These tests guard that decoupling so a UAT environment can keep
// email/WhatsApp stubbed while still writing real bytes to S3.

const ORIGINAL_ENV: Record<string, string | undefined> = {};
const KEYS = [
  'INTEGRATIONS_MODE',
  'STORAGE_PROVIDER',
  'AWS_S3_BUCKET',
  'AWS_REGION',
] as const;

describe('integrations factory — storage routing', () => {
  beforeEach(() => {
    KEYS.forEach((k) => {
      ORIGINAL_ENV[k] = process.env[k];
    });
    setIntegrations(null);
    process.env.AWS_S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'ap-south-1';
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
      else process.env[k] = ORIGINAL_ENV[k]!;
    });
    resetEnvCache();
    resetIntegrationsCache();
    setIntegrations(null);
  });

  it('picks S3StorageAdapter when STORAGE_PROVIDER=s3 even with INTEGRATIONS_MODE=stub', () => {
    process.env.INTEGRATIONS_MODE = 'stub';
    process.env.STORAGE_PROVIDER = 's3';
    resetEnvCache();
    resetIntegrationsCache();
    const { storage } = getIntegrations();
    expect(storage).toBeInstanceOf(S3StorageAdapter);
  });

  it('picks ConsoleStorageAdapter when STORAGE_PROVIDER=stub regardless of INTEGRATIONS_MODE', () => {
    process.env.INTEGRATIONS_MODE = 'live';
    process.env.STORAGE_PROVIDER = 'stub';
    resetEnvCache();
    resetIntegrationsCache();
    const { storage } = getIntegrations();
    expect(storage).toBeInstanceOf(ConsoleStorageAdapter);
  });

  it('picks MongoStorageAdapter when STORAGE_PROVIDER=mongo with INTEGRATIONS_MODE=stub', () => {
    process.env.INTEGRATIONS_MODE = 'stub';
    process.env.STORAGE_PROVIDER = 'mongo';
    resetEnvCache();
    resetIntegrationsCache();
    const { storage } = getIntegrations();
    expect(storage).toBeInstanceOf(MongoStorageAdapter);
  });
});
