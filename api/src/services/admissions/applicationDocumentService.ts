import { Types } from 'mongoose';
import type {
  ApplicationDocumentDto,
  RegisterDocumentInput,
  SignDocumentUploadInput,
  SignedUploadTicketDto,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import { getIntegrations } from '../../integrations/index.js';
import {
  Application,
  ApplicationDocument,
  type HydratedApplicationDocument,
} from '../../models/index.js';
import type { ApplicationDocumentType } from '../../models/admissions/applicationDocument.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const MAX_BYTES = 10 * 1024 * 1024;

const TYPE_LABEL: Record<ApplicationDocumentType, string> = {
  govid: 'Government ID',
  transcript: 'Prior transcript',
  resume: 'Resume / CV',
  portfolio: 'Portfolio',
  test_score: 'Test score report',
  other: 'Supporting document',
  referee_letter: 'Letter of recommendation',
};

function ensureMimeAndSize(mime: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Only PDF, JPG, and PNG files are accepted.',
    );
  }
  if (size <= 0 || size > MAX_BYTES) {
    throw new HttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Files must be 10 MB or smaller. Got ${(size / (1024 * 1024)).toFixed(1)} MB.`,
    );
  }
}

export async function signDocumentUploadForApplicant(
  applicantUserId: Types.ObjectId,
  input: SignDocumentUploadInput,
): Promise<SignedUploadTicketDto> {
  ensureMimeAndSize(input.mimeType, input.sizeBytes);
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const ext = mimeToExt(input.mimeType);
  const filename = `${input.documentType}-${Date.now()}.${ext}`;
  const { storage } = getIntegrations();
  const ticket = await storage.signedUploadTicket({
    folder: 'application-documents',
    filename,
    contentType: input.mimeType,
    ttlSec: 300,
  });
  return {
    url: ticket.url,
    key: ticket.key,
    headers: ticket.headers ?? {},
    expiresAt: ticket.expiresAt,
  };
}

export async function registerDocumentForApplicant(
  applicantUserId: Types.ObjectId,
  input: RegisterDocumentInput,
): Promise<HydratedApplicationDocument> {
  ensureMimeAndSize(input.mimeType, input.sizeBytes);
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const documentType = input.documentType as ApplicationDocumentType;
  // Only one document per type per application — re-uploading replaces.
  await ApplicationDocument.deleteOne({
    applicationId: application._id,
    documentType,
    uploadedByRole: 'applicant',
  });
  const doc = await ApplicationDocument.create({
    applicationId: application._id,
    applicantUserId,
    documentType,
    label: input.label?.trim() || TYPE_LABEL[documentType] || 'Document',
    url: input.url,
    key: input.key,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    uploadedByRole: 'applicant',
    refereeId: null,
  });
  return doc;
}

export async function listDocumentsForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<HydratedApplicationDocument[]> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) return [];
  return ApplicationDocument.find({ applicationId: application._id }).sort({ uploadedAt: -1 });
}

export async function deleteApplicantDocument(
  applicantUserId: Types.ObjectId,
  id: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Document not found.');
  }
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'Document not found.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const doc = await ApplicationDocument.findOne({
    _id: new Types.ObjectId(id),
    applicationId: application._id,
  });
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'Document not found.');
  }
  // Cloudinary delete is best-effort — keep going even if the storage layer
  // fails so the row at least disappears from the applicant's view.
  try {
    const { storage } = getIntegrations();
    await storage.delete(doc.key);
  } catch {
    // log via adapter; swallow
  }
  await ApplicationDocument.deleteOne({ _id: doc._id });
}

export function toApplicationDocumentDto(
  doc: HydratedApplicationDocument,
): ApplicationDocumentDto {
  return {
    id: String(doc._id),
    applicationId: doc.applicationId.toString(),
    documentType: doc.documentType === 'referee_letter' ? 'other' : doc.documentType,
    label: doc.label,
    url: doc.url,
    key: doc.key,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt.toISOString(),
    uploadedByRole: doc.uploadedByRole,
  };
}

function mimeToExt(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'bin';
}
