import { Types } from 'mongoose';
import type {
  AddRefereeInput,
  RefereeDto,
  RefereeUploadContextDto,
  SignedUploadTicketDto,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import { loadEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { getIntegrations } from '../../integrations/index.js';
import {
  Application,
  ApplicationDocument,
  Program,
  Referee,
  RefereeUploadToken,
  User,
  type HydratedReferee,
} from '../../models/index.js';
import { generateOpaqueToken, sha256 } from '../tokenService.js';

const MAX_REFEREES = 5;
const RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REFEREE_TOKEN_TTL_DAYS = 30;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_BYTES = 10 * 1024 * 1024;

export async function listRefereesForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<HydratedReferee[]> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) return [];
  return Referee.find({ applicationId: application._id }).sort({ invitedAt: 1 });
}

export async function addReferee(
  applicantUserId: Types.ObjectId,
  input: AddRefereeInput,
): Promise<HydratedReferee> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const count = await Referee.countDocuments({ applicationId: application._id });
  if (count >= MAX_REFEREES) {
    throw new HttpError(409, 'VALIDATION_FAILED', `You can add at most ${MAX_REFEREES} referees.`);
  }
  const email = input.email.trim().toLowerCase();
  const existing = await Referee.findOne({ applicationId: application._id, email });
  if (existing) {
    throw new HttpError(409, 'REFEREE_EXISTS', 'You\'ve already added a referee with this email.');
  }
  const referee = await Referee.create({
    applicationId: application._id,
    applicantUserId,
    name: input.name.trim(),
    relationship: input.relationship.trim(),
    organization: input.organization.trim(),
    email,
    phoneE164: input.phoneE164?.trim() || null,
    status: 'invited',
    invitedAt: new Date(),
  });
  await issueTokenAndEmail(referee, application._id, applicantUserId, false);
  return referee;
}

export async function resendReferee(
  applicantUserId: Types.ObjectId,
  refereeId: string,
): Promise<HydratedReferee> {
  if (!Types.ObjectId.isValid(refereeId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  const referee = await Referee.findOne({
    _id: new Types.ObjectId(refereeId),
    applicationId: application._id,
  });
  if (!referee) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  if (referee.status === 'uploaded') {
    throw new HttpError(409, 'VALIDATION_FAILED', 'Referee has already uploaded their letter.');
  }
  if (
    referee.lastResendAt
    && Date.now() - referee.lastResendAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      'You\'ve already resent recently. Try again in 24 hours.',
    );
  }
  await issueTokenAndEmail(referee, application._id, applicantUserId, true);
  return referee;
}

export async function deleteReferee(
  applicantUserId: Types.ObjectId,
  refereeId: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(refereeId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const referee = await Referee.findOne({
    _id: new Types.ObjectId(refereeId),
    applicationId: application._id,
  });
  if (!referee) {
    throw new HttpError(404, 'NOT_FOUND', 'Referee not found.');
  }
  // If a letter was uploaded, drop the storage object + the document row.
  if (referee.letterDocumentId) {
    const docRow = await ApplicationDocument.findById(referee.letterDocumentId);
    if (docRow) {
      try {
        const { storage } = getIntegrations();
        await storage.delete(docRow.key);
      } catch (err) {
        logger.warn({ err, key: docRow.key }, 'referee.delete.storage_skip');
      }
      await ApplicationDocument.deleteOne({ _id: docRow._id });
    }
  }
  await Referee.deleteOne({ _id: referee._id });
  await RefereeUploadToken.deleteMany({ refereeId: referee._id });
}

// --------- Public side (no auth, validated by token) ----------

export async function resolveTokenContext(
  rawToken: string,
): Promise<{
  context: RefereeUploadContextDto;
  refereeId: Types.ObjectId;
  applicationId: Types.ObjectId;
  tokenId: Types.ObjectId;
}> {
  if (!rawToken) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Invalid link.');
  }
  const tokenHash = sha256(rawToken);
  const record = await RefereeUploadToken.findOne({ tokenHash });
  if (!record) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'This link is no longer valid.');
  }
  if (record.usedAt) {
    throw new HttpError(410, 'TOKEN_USED', 'This link has already been used.');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'This link has expired.');
  }
  const referee = await Referee.findById(record.refereeId);
  if (!referee) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'This link is no longer valid.');
  }
  const application = await Application.findById(referee.applicationId);
  if (!application || application.state !== 'draft' && application.state !== 'submitted'
    && application.state !== 'under_review' && application.state !== 'decision_pending') {
    // Reject uploads when the application is in a terminal state.
    throw new HttpError(410, 'APPLICATION_LOCKED', 'The application is no longer accepting referee uploads.');
  }
  const applicant = await User.findById(application.applicantUserId).select('name');
  const program = application.programId
    ? await Program.findById(application.programId).select('name')
    : null;
  const firstName = (applicant?.name ?? 'an applicant').split(/\s+/)[0] ?? 'an applicant';
  return {
    context: {
      applicantFirstName: firstName,
      programName: program?.name ?? null,
      refereeName: referee.name,
      refereeEmail: referee.email,
      expiresAt: record.expiresAt.toISOString(),
    },
    refereeId: referee._id,
    applicationId: application._id,
    tokenId: record._id,
  };
}

export async function refereeSignUpload(
  rawToken: string,
  input: { mimeType: string; sizeBytes: number },
): Promise<SignedUploadTicketDto> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Only PDF, JPG, or PNG.');
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Letters must be 10 MB or smaller.');
  }
  await resolveTokenContext(rawToken); // throws if invalid
  const ext = input.mimeType === 'application/pdf' ? 'pdf' : input.mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const { storage } = getIntegrations();
  const ticket = await storage.signedUploadTicket({
    folder: 'referee-uploads',
    filename: `letter-${Date.now()}.${ext}`,
    contentType: input.mimeType,
    ttlSec: 600,
  });
  return {
    url: ticket.url,
    key: ticket.key,
    headers: ticket.headers ?? {},
    expiresAt: ticket.expiresAt,
  };
}

export async function recordRefereeUpload(
  rawToken: string,
  input: { url: string; key: string; sizeBytes: number; mimeType: string },
): Promise<void> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Only PDF, JPG, or PNG.');
  }
  const ctx = await resolveTokenContext(rawToken);
  // Single letter per referee — replace if a prior attempt got farther than
  // sign-upload but the token wasn't marked used. (Defensive; shouldn't
  // happen in normal flow because mark-used is the last step.)
  const referee = await Referee.findById(ctx.refereeId);
  if (!referee) {
    throw new HttpError(410, 'TOKEN_EXPIRED', 'Referee record missing.');
  }
  if (referee.letterDocumentId) {
    await ApplicationDocument.deleteOne({ _id: referee.letterDocumentId });
  }
  const docRow = await ApplicationDocument.create({
    applicationId: ctx.applicationId,
    applicantUserId: referee.applicantUserId,
    documentType: 'referee_letter',
    label: `Letter from ${referee.name}`,
    url: input.url,
    key: input.key,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    uploadedByRole: 'referee',
    refereeId: referee._id,
  });
  referee.letterDocumentId = docRow._id;
  referee.status = 'uploaded';
  referee.uploadedAt = new Date();
  await referee.save();
  // Mark the token used so the link can't be replayed.
  await RefereeUploadToken.updateOne(
    { _id: ctx.tokenId, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
}

// --------- helpers ----------

async function issueTokenAndEmail(
  referee: HydratedReferee,
  applicationId: Types.ObjectId,
  applicantUserId: Types.ObjectId,
  isResend: boolean,
): Promise<void> {
  // Invalidate any prior unused token for this referee.
  await RefereeUploadToken.updateMany(
    { refereeId: referee._id, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  const { plain, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFEREE_TOKEN_TTL_DAYS * 86_400_000);
  await RefereeUploadToken.create({
    refereeId: referee._id,
    applicationId,
    tokenHash,
    expiresAt,
    usedAt: null,
  });
  const env = loadEnv();
  const link = `${env.WEB_ORIGIN.replace(/\/$/, '')}/refer/${encodeURIComponent(plain)}`;
  const applicant = await User.findById(applicantUserId).select('name email');
  const applicantName = applicant?.name ?? 'a prospective student';
  const program = (await Program.findById((await Application.findById(applicationId))?.programId))?.name;

  const { email: mailer } = getIntegrations();
  try {
    await mailer.send({
      to: referee.email,
      subject: isResend
        ? `Reminder: upload your letter for ${applicantName}`
        : `${applicantName} has asked for your reference for India Learns`,
      html: `<p>Hi ${referee.name},</p>
        <p>${applicantName} is applying${program ? ` to ${program}` : ''} at India Learns and has listed you as a referee.</p>
        <p>Use the secure link below to upload your letter of recommendation. It expires in ${REFEREE_TOKEN_TTL_DAYS} days and can only be used once.</p>
        <p><a href="${link}">${link}</a></p>
        <p>Thank you.</p>`,
      text: `Hi ${referee.name},\n\n${applicantName} is applying${program ? ` to ${program}` : ''} at India Learns and has listed you as a referee.\n\nUpload your letter using this single-use link (expires in ${REFEREE_TOKEN_TTL_DAYS} days):\n${link}\n\nThanks,\nIndia Learns Admissions`,
      tag: isResend ? 'referee-reminder' : 'referee-invite',
      vars: { name: referee.name, refereeUrl: link, applicantName },
    });
  } catch (err) {
    logger.warn({ err, refereeId: String(referee._id) }, 'referee.email.failed');
  }
  referee.lastResendAt = new Date();
  if (isResend && referee.status === 'invited') {
    referee.status = 'reminded';
    referee.remindedAt = new Date();
  }
  await referee.save();
}

export function toRefereeDto(doc: HydratedReferee, includeLetterUrl = false): RefereeDto {
  return {
    id: String(doc._id),
    applicationId: doc.applicationId.toString(),
    name: doc.name,
    relationship: doc.relationship,
    organization: doc.organization,
    email: doc.email,
    phoneE164: doc.phoneE164,
    status: doc.status,
    invitedAt: doc.invitedAt.toISOString(),
    remindedAt: doc.remindedAt ? doc.remindedAt.toISOString() : null,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.toISOString() : null,
    letterUrl: includeLetterUrl && doc.letterDocumentId
      ? `/v1/admissions/officer/documents/${doc.letterDocumentId.toString()}/url`
      : undefined,
  };
}
