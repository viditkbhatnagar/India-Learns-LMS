import { afterEach, beforeEach } from 'vitest';
import type {
  EmailAdapter,
  EmailSendInput,
  EmailSendResult,
  WhatsAppAdapter,
  WhatsAppSendInput,
  WhatsAppSendResult,
} from 'india-learns-shared-types';
import { setIntegrations } from '../../src/integrations/index.js';

export class SpyEmailAdapter implements EmailAdapter {
  public calls: EmailSendInput[] = [];

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    this.calls.push(input);
    return { providerId: `spy-${this.calls.length}` };
  }

  lastInviteLink(): string | null {
    for (let i = this.calls.length - 1; i >= 0; i -= 1) {
      const c = this.calls[i]!;
      const url =
        (c.vars?.inviteUrl as string | undefined) ??
        (c.vars?.resetUrl as string | undefined);
      if (url) return url;
    }
    return null;
  }

  lastInviteToken(): string | null {
    const url = this.lastInviteLink();
    if (!url) return null;
    const match = /[?&]t=([^&]+)/.exec(url);
    return match ? decodeURIComponent(match[1]!) : null;
  }

  reset(): void {
    this.calls = [];
  }
}

export class SpyWhatsAppAdapter implements WhatsAppAdapter {
  public calls: WhatsAppSendInput[] = [];

  async sendTemplate(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    this.calls.push(input);
    return { providerId: `spy-wa-${this.calls.length}` };
  }

  reset(): void {
    this.calls = [];
  }
}

export interface IntegrationSpies {
  email: SpyEmailAdapter;
  whatsapp: SpyWhatsAppAdapter;
}

export function useIntegrationSpies(): IntegrationSpies {
  const spies: IntegrationSpies = {
    email: new SpyEmailAdapter(),
    whatsapp: new SpyWhatsAppAdapter(),
  };
  beforeEach(() => {
    spies.email.reset();
    spies.whatsapp.reset();
    setIntegrations({ email: spies.email, whatsapp: spies.whatsapp });
  });
  afterEach(() => {
    setIntegrations(null);
  });
  return spies;
}
