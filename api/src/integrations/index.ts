import type {
  EmailAdapter,
  StorageAdapter,
  WhatsAppAdapter,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import {
  ConsoleEmailAdapter,
  ResendEmailAdapter,
  SendGridEmailAdapter,
} from './emailAdapter.js';
import {
  ConsoleWhatsAppAdapter,
  MetaWabaAdapter,
} from './whatsappAdapter.js';
import {
  CloudinaryStorageAdapter,
  ConsoleStorageAdapter,
} from './storageAdapter.js';

export interface Integrations {
  email: EmailAdapter;
  whatsapp: WhatsAppAdapter;
  storage: StorageAdapter;
}

export interface IntegrationsOverride {
  email?: EmailAdapter;
  whatsapp?: WhatsAppAdapter;
  storage?: StorageAdapter;
}

let override: IntegrationsOverride | null = null;

function build(): Integrations {
  const env = loadEnv();
  const stub = env.INTEGRATIONS_MODE === 'stub';
  const email: EmailAdapter = stub
    ? new ConsoleEmailAdapter()
    : env.EMAIL_PROVIDER === 'sendgrid'
      ? new SendGridEmailAdapter()
      : env.EMAIL_PROVIDER === 'resend'
        ? new ResendEmailAdapter()
        : new ConsoleEmailAdapter();
  const whatsapp: WhatsAppAdapter =
    stub || !env.WHATSAPP_ENABLED
      ? new ConsoleWhatsAppAdapter()
      : new MetaWabaAdapter();
  const storage: StorageAdapter =
    stub || env.STORAGE_PROVIDER === 'stub'
      ? new ConsoleStorageAdapter()
      : new CloudinaryStorageAdapter();
  return { email, whatsapp, storage };
}

let cached: Integrations | null = null;

export function getIntegrations(): Integrations {
  if (!cached) cached = build();
  if (override) {
    return {
      email: override.email ?? cached.email,
      whatsapp: override.whatsapp ?? cached.whatsapp,
      storage: override.storage ?? cached.storage,
    };
  }
  return cached;
}

/** Test-only: inject spy adapters. Pass `null` to clear. */
export function setIntegrations(next: IntegrationsOverride | null): void {
  override = next;
}

/** Test-only: drop the cached factory output (e.g., after env mutation). */
export function resetIntegrationsCache(): void {
  cached = null;
}
