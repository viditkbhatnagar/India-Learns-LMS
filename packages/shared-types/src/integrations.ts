export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateId?: string;
  vars?: Record<string, unknown>;
  tag?: string;
}

export interface EmailSendResult {
  providerId: string;
}

export interface EmailAdapter {
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export interface WhatsAppSendInput {
  toE164: string;
  templateName: string;
  languageCode: string;
  vars: string[];
  mediaUrl?: string;
}

export interface WhatsAppSendResult {
  providerId: string;
}

export interface WhatsAppAdapter {
  sendTemplate(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
}
