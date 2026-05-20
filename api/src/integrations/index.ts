import type {
  CertificateAdapter,
  EmailAdapter,
  StorageAdapter,
  WhatsAppAdapter,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import {
  BrevoEmailAdapter,
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
import { MongoStorageAdapter } from './mongoStorageAdapter.js';
import {
  CertifierIoAdapter,
  ConsoleCertificateAdapter,
} from './certificateAdapter.js';

export interface Integrations {
  email: EmailAdapter;
  /** Optional fallback email adapter (SendGrid). Used when primary 5xx/timeouts. */
  emailFallback: EmailAdapter | null;
  whatsapp: WhatsAppAdapter;
  storage: StorageAdapter;
  certificate: CertificateAdapter;
}

export interface IntegrationsOverride {
  email?: EmailAdapter;
  emailFallback?: EmailAdapter | null;
  whatsapp?: WhatsAppAdapter;
  storage?: StorageAdapter;
  certificate?: CertificateAdapter;
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
        : env.EMAIL_PROVIDER === 'brevo'
          ? new BrevoEmailAdapter()
          : new ConsoleEmailAdapter();
  // M9 — primary email provider can be Resend, SendGrid, or Brevo. SendGrid
  // is the configured fallback for any non-SendGrid primary when the key is
  // present. notificationService.sendEmailWithFallback writes two cost-ledger
  // rows when the fallback wins.
  const emailFallback: EmailAdapter | null =
    !stub &&
    env.EMAIL_PROVIDER !== 'sendgrid' &&
    env.EMAIL_PROVIDER !== 'stub' &&
    env.SENDGRID_API_KEY
      ? new SendGridEmailAdapter()
      : null;
  const whatsapp: WhatsAppAdapter =
    stub || !env.WHATSAPP_ENABLED
      ? new ConsoleWhatsAppAdapter()
      : new MetaWabaAdapter();
  // M10q — Storage provider order:
  //   1. INTEGRATIONS_MODE=stub or STORAGE_PROVIDER=stub → in-memory stub.
  //   2. STORAGE_PROVIDER=mongo → GridFS in the app's Atlas DB (default).
  //   3. STORAGE_PROVIDER=cloudinary → Cloudinary CDN.
  // Mongo is the new default so production "just works" the moment Atlas is
  // connected — no Cloudinary keys required.
  const storage: StorageAdapter =
    stub || env.STORAGE_PROVIDER === 'stub'
      ? new ConsoleStorageAdapter()
      : env.STORAGE_PROVIDER === 'mongo'
        ? new MongoStorageAdapter()
        : new CloudinaryStorageAdapter();
  const certificate: CertificateAdapter =
    stub || !env.CERTIFIER_ENABLED
      ? new ConsoleCertificateAdapter()
      : new CertifierIoAdapter();
  return { email, emailFallback, whatsapp, storage, certificate };
}

let cached: Integrations | null = null;

export function getIntegrations(): Integrations {
  if (!cached) cached = build();
  if (override) {
    return {
      email: override.email ?? cached.email,
      emailFallback:
        override.emailFallback !== undefined
          ? override.emailFallback
          : cached.emailFallback,
      whatsapp: override.whatsapp ?? cached.whatsapp,
      storage: override.storage ?? cached.storage,
      certificate: override.certificate ?? cached.certificate,
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
