import { nanoid } from 'nanoid';
import type {
  EmailAdapter,
  EmailSendInput,
  EmailSendResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';

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

export class ResendEmailAdapter implements EmailAdapter {
  async send(_input: EmailSendInput): Promise<EmailSendResult> {
    throw new Error('ResendEmailAdapter not wired — scheduled for M8.');
  }
}

export class SendGridEmailAdapter implements EmailAdapter {
  async send(_input: EmailSendInput): Promise<EmailSendResult> {
    throw new Error('SendGridEmailAdapter not wired — scheduled for M8.');
  }
}
