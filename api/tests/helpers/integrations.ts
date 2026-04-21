import { afterEach, beforeEach } from 'vitest';
import type {
  EmailAdapter,
  EmailSendInput,
  EmailSendResult,
  StorageAdapter,
  StorageFolder,
  StorageSignedUploadTicket,
  StorageUploadInput,
  StorageUploadResult,
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

export class SpyStorageAdapter implements StorageAdapter {
  public uploads: StorageUploadInput[] = [];

  public deletes: string[] = [];

  public signedUrls: string[] = [];

  public tickets: Array<{
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }> = [];

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    this.uploads.push(input);
    return {
      url: `https://spy.test/${input.folder}/${this.uploads.length}`,
      key: `spy:${input.folder}:${this.uploads.length}`,
    };
  }

  async delete(key: string): Promise<void> {
    this.deletes.push(key);
  }

  async signedUrl(key: string): Promise<string> {
    this.signedUrls.push(key);
    return `https://spy.test/signed?key=${encodeURIComponent(key)}`;
  }

  async signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    this.tickets.push(input);
    return {
      url: `https://spy.test/upload/${input.folder}/${this.tickets.length}`,
      key: `spy:${input.folder}:${this.tickets.length}`,
      headers: { 'content-type': input.contentType },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  reset(): void {
    this.uploads = [];
    this.deletes = [];
    this.signedUrls = [];
    this.tickets = [];
  }
}

export interface IntegrationSpies {
  email: SpyEmailAdapter;
  whatsapp: SpyWhatsAppAdapter;
  storage: SpyStorageAdapter;
}

export function useIntegrationSpies(): IntegrationSpies {
  const spies: IntegrationSpies = {
    email: new SpyEmailAdapter(),
    whatsapp: new SpyWhatsAppAdapter(),
    storage: new SpyStorageAdapter(),
  };
  beforeEach(() => {
    spies.email.reset();
    spies.whatsapp.reset();
    spies.storage.reset();
    setIntegrations({
      email: spies.email,
      whatsapp: spies.whatsapp,
      storage: spies.storage,
    });
  });
  afterEach(() => {
    setIntegrations(null);
  });
  return spies;
}
