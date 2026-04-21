import { nanoid } from 'nanoid';
import type {
  WhatsAppAdapter,
  WhatsAppSendInput,
  WhatsAppSendResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';

export class ConsoleWhatsAppAdapter implements WhatsAppAdapter {
  async sendTemplate(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const providerId = `console-${nanoid(12)}`;
    logger.info(
      {
        toE164: input.toE164,
        templateName: input.templateName,
        languageCode: input.languageCode,
        vars: input.vars,
        providerId,
      },
      'whatsapp.sendTemplate',
    );
    return { providerId };
  }
}

export class MetaWabaAdapter implements WhatsAppAdapter {
  async sendTemplate(_input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    throw new Error('MetaWabaAdapter not wired — scheduled for M4 / M5.');
  }
}
