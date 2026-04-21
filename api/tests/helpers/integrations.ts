import { afterEach, beforeEach } from 'vitest';
import type {
  CertificateAdapter,
  CertificateIssueInput,
  CertificateIssueResult,
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

  private bytesByKey = new Map<string, Uint8Array>();

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    this.uploads.push(input);
    // Use the `stub:` prefix so the ConsoleStorageAdapter.getCached fallback
    // in /v1/receipts/:id/download can also serve bytes from the spy cache.
    const key = `stub:${input.folder}:spy-${this.uploads.length}`;
    if (input.bytes) {
      this.bytesByKey.set(key, input.bytes);
      const { ConsoleStorageAdapter } = await import(
        '../../src/integrations/storageAdapter.js'
      );
      ConsoleStorageAdapter.setCached(key, input.bytes);
    }
    return {
      url: `https://spy.test/${input.folder}/${this.uploads.length}`,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    this.deletes.push(key);
    this.bytesByKey.delete(key);
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
    this.bytesByKey.clear();
  }
}

export class SpyCertificateAdapter implements CertificateAdapter {
  public calls: CertificateIssueInput[] = [];

  public nextResult: CertificateIssueResult | null = null;

  public failNext = false;

  async issue(input: CertificateIssueInput): Promise<CertificateIssueResult> {
    this.calls.push(input);
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Spy certificate failure');
    }
    const idx = this.calls.length;
    return (
      this.nextResult ?? {
        certificateUrl: `https://spy.test/cert/${input.idempotencyKey}-${idx}`,
        providerId: `spy-cert-${idx}`,
      }
    );
  }

  reset(): void {
    this.calls = [];
    this.nextResult = null;
    this.failNext = false;
  }
}

export interface IntegrationSpies {
  email: SpyEmailAdapter;
  /** Secondary email adapter (Resend → SendGrid fallback). Null by default so
   * legacy M2–M7 tests that assume "primary fails → error persisted" still pass.
   * Opt-in per-test via `spies.useEmailFallback = new SpyEmailAdapter()` plus
   * a re-apply of setIntegrations before the assertion. */
  emailFallback: SpyEmailAdapter | null;
  whatsapp: SpyWhatsAppAdapter;
  storage: SpyStorageAdapter;
  certificate: SpyCertificateAdapter;
}

export function useIntegrationSpies(): IntegrationSpies {
  const spies: IntegrationSpies = {
    email: new SpyEmailAdapter(),
    emailFallback: null,
    whatsapp: new SpyWhatsAppAdapter(),
    storage: new SpyStorageAdapter(),
    certificate: new SpyCertificateAdapter(),
  };
  beforeEach(() => {
    spies.email.reset();
    spies.emailFallback = null;
    spies.whatsapp.reset();
    spies.storage.reset();
    spies.certificate.reset();
    setIntegrations({
      email: spies.email,
      emailFallback: null,
      whatsapp: spies.whatsapp,
      storage: spies.storage,
      certificate: spies.certificate,
    });
  });
  afterEach(() => {
    setIntegrations(null);
  });
  return spies;
}
