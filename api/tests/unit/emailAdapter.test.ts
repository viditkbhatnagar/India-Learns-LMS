import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../../src/config/env.js';
import {
  BrevoEmailAdapter,
  ResendEmailAdapter,
  SendGridEmailAdapter,
} from '../../src/integrations/emailAdapter.js';

const SNAPSHOT_KEYS = [
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'BREVO_API_KEY',
] as const;

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('email adapters (live)', () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of SNAPSHOT_KEYS) snapshot[k] = process.env[k];
    process.env.EMAIL_FROM = 'India Learns <notifications@app.indialearns.com>';
    process.env.RESEND_API_KEY = 'rs_test_xxxx';
    process.env.SENDGRID_API_KEY = 'SG.test_xxxx';
    process.env.BREVO_API_KEY = 'xkeysib-test-xxxx';
    resetEnvCache();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    for (const k of SNAPSHOT_KEYS) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
    resetEnvCache();
    vi.unstubAllGlobals();
  });

  describe('ResendEmailAdapter', () => {
    it('POSTs to Resend with bearer auth and parsed from-address', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { id: 'rs_msg_123' }));
      const out = await new ResendEmailAdapter().send({
        to: 'student@example.com',
        subject: 'Welcome',
        html: '<p>hi</p>',
        text: 'hi',
        tag: 'invite',
      });
      expect(out.providerId).toBe('rs_msg_123');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer rs_test_xxxx');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.from).toBe('India Learns <notifications@app.indialearns.com>');
      expect(body.to).toEqual(['student@example.com']);
      expect(body.tags).toEqual([{ name: 'category', value: 'invite' }]);
    });

    it('throws when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;
      resetEnvCache();
      await expect(
        new ResendEmailAdapter().send({
          to: 'a@b.co',
          subject: 's',
          html: '<p>',
          text: 't',
        }),
      ).rejects.toThrow(/RESEND_API_KEY/);
    });

    it('throws on non-2xx with truncated body', async () => {
      fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));
      await expect(
        new ResendEmailAdapter().send({
          to: 'a@b.co',
          subject: 's',
          html: '<p>',
          text: 't',
        }),
      ).rejects.toThrow(/Resend responded 429/);
    });
  });

  describe('SendGridEmailAdapter', () => {
    it('POSTs to SendGrid v3 mail/send and reads X-Message-Id', async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 202,
          headers: { 'x-message-id': 'sg_abc' },
        }),
      );
      const out = await new SendGridEmailAdapter().send({
        to: 'student@example.com',
        subject: 'Hi',
        html: '<p>x</p>',
        text: 'x',
      });
      expect(out.providerId).toBe('sg_abc');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.from.email).toBe('notifications@app.indialearns.com');
      expect(body.from.name).toBe('India Learns');
      expect(body.personalizations[0].to[0].email).toBe('student@example.com');
    });

    it('throws when SENDGRID_API_KEY is missing', async () => {
      delete process.env.SENDGRID_API_KEY;
      resetEnvCache();
      await expect(
        new SendGridEmailAdapter().send({
          to: 'a@b.co',
          subject: 's',
          html: '<p>',
          text: 't',
        }),
      ).rejects.toThrow(/SENDGRID_API_KEY/);
    });
  });

  describe('BrevoEmailAdapter', () => {
    it('POSTs to Brevo with api-key header', async () => {
      fetchMock.mockResolvedValue(jsonResponse(201, { messageId: 'brevo_42' }));
      const out = await new BrevoEmailAdapter().send({
        to: 'student@example.com',
        subject: 'Hi',
        html: '<p>x</p>',
        text: 'x',
      });
      expect(out.providerId).toBe('brevo_42');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['api-key']).toBe('xkeysib-test-xxxx');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.sender.email).toBe('notifications@app.indialearns.com');
      expect(body.to).toEqual([{ email: 'student@example.com' }]);
    });

    it('throws when BREVO_API_KEY is missing', async () => {
      delete process.env.BREVO_API_KEY;
      resetEnvCache();
      await expect(
        new BrevoEmailAdapter().send({
          to: 'a@b.co',
          subject: 's',
          html: '<p>',
          text: 't',
        }),
      ).rejects.toThrow(/BREVO_API_KEY/);
    });
  });
});
