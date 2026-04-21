import type {
  EmailAdapter,
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

export interface Integrations {
  email: EmailAdapter;
  whatsapp: WhatsAppAdapter;
}

let override: Integrations | null = null;

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
  return { email, whatsapp };
}

let cached: Integrations | null = null;

export function getIntegrations(): Integrations {
  if (override) return override;
  if (!cached) cached = build();
  return cached;
}

/** Test-only: inject spy adapters. */
export function setIntegrations(next: Integrations | null): void {
  override = next;
}

/** Test-only: drop the cached factory output (e.g., after env mutation). */
export function resetIntegrationsCache(): void {
  cached = null;
}
