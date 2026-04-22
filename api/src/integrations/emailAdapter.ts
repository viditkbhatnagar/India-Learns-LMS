import { nanoid } from 'nanoid';
import type {
  EmailAdapter,
  EmailSendInput,
  EmailSendResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';

export class ConsoleEmailAdapter implements EmailAdapter {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const providerId = `console-${nanoid(12)}`;
    logger.info(
      {
        to: input.to,
        subject: input.subject,
        tag: input.tag ?? null,
        vars: input.vars ?? null,
        text: input.text,
        providerId,
      },
      'email.send',
    );
    return { providerId };
  }
}

interface FromAddress {
  name?: string;
  email: string;
}

// Accepts either `"Name <addr@host>"` or a bare `"addr@host"` form. Used by
// every live adapter so EMAIL_FROM can be set to the human-friendly variant
// without each provider re-parsing.
function parseFromAddress(raw: string): FromAddress {
  const match = raw.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (match && match[1] && match[2]) {
    return { name: match[1], email: match[2] };
  }
  return { email: raw.trim() };
}

const SEND_TIMEOUT_MS = 10_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  providerLabel: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `${providerLabel} responded ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Resend (https://resend.com) — REST POST /emails. Returns `{ id }`.
export class ResendEmailAdapter implements EmailAdapter {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const env = loadEnv();
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    }
    const from = parseFromAddress(env.EMAIL_FROM);
    const fromHeader = from.name ? `${from.name} <${from.email}>` : from.email;
    const res = await postJson(
      'https://api.resend.com/emails',
      { authorization: `Bearer ${env.RESEND_API_KEY}` },
      {
        from: fromHeader,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tag ? [{ name: 'category', value: input.tag }] : undefined,
      },
      'Resend',
    );
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerId: json.id ?? `resend-${nanoid(10)}` };
  }
}

// SendGrid v3 (https://sendgrid.com/docs/api-reference/) — POST /v3/mail/send.
// Returns 202 with X-Message-Id header on success.
export class SendGridEmailAdapter implements EmailAdapter {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const env = loadEnv();
    if (!env.SENDGRID_API_KEY) {
      throw new Error(
        'SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid (or as fallback)',
      );
    }
    const from = parseFromAddress(env.EMAIL_FROM);
    const res = await postJson(
      'https://api.sendgrid.com/v3/mail/send',
      { authorization: `Bearer ${env.SENDGRID_API_KEY}` },
      {
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: from.email, name: from.name },
        subject: input.subject,
        content: [
          { type: 'text/plain', value: input.text },
          { type: 'text/html', value: input.html },
        ],
        categories: input.tag ? [input.tag] : undefined,
      },
      'SendGrid',
    );
    const messageId = res.headers.get('x-message-id') ?? `sendgrid-${nanoid(10)}`;
    return { providerId: messageId };
  }
}

// Brevo (formerly Sendinblue, https://developers.brevo.com) — POST /v3/smtp/email.
// Returns `{ messageId }` on success. Uses `api-key` header (not Bearer).
export class BrevoEmailAdapter implements EmailAdapter {
  async send(input: EmailSendInput): Promise<EmailSendResult> {
    const env = loadEnv();
    if (!env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is required when EMAIL_PROVIDER=brevo');
    }
    const from = parseFromAddress(env.EMAIL_FROM);
    const res = await postJson(
      'https://api.brevo.com/v3/smtp/email',
      { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
      {
        sender: { email: from.email, name: from.name },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
        tags: input.tag ? [input.tag] : undefined,
      },
      'Brevo',
    );
    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { providerId: json.messageId ?? `brevo-${nanoid(10)}` };
  }
}
