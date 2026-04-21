import type { StorageFolder } from './enums.js';

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

export interface StorageUploadInput {
  /** Raw bytes to upload. `Buffer` from Node extends `Uint8Array` so both work. */
  bytes?: Uint8Array;
  filename: string;
  folder: StorageFolder;
  contentType: string;
}

export interface StorageUploadResult {
  url: string;
  key: string;
}

export interface StorageSignedUploadTicket {
  url: string;
  key: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, ttlSec?: number): Promise<string>;
  signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket>;
}

// M8 — Certifier.io (TRD §9.4). Idempotency key is the enrolment id; if the
// upstream returns a duplicate, capture the existing certificate URL rather
// than failing. Stub adapter returns a deterministic fake URL in dev.
export interface CertificateIssueInput {
  studentName: string;
  email: string;
  courseName: string;
  completionDate: Date;
  templateId: string;
  /** Idempotency key — the enrolment _id. Upstream uses this to dedupe. */
  idempotencyKey: string;
}

export interface CertificateIssueResult {
  certificateUrl: string;
  providerId: string;
}

export interface CertificateAdapter {
  issue(input: CertificateIssueInput): Promise<CertificateIssueResult>;
}
