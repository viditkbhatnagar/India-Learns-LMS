import type { Types } from 'mongoose';
import { HttpError } from '../../middleware/error.js';
import { Application, Program } from '../../models/index.js';

// M3a — Single long-text statement. Per-program word limit; default 1000.
// The applicant can save the field as draft repeatedly; submit-time
// validation in M4 enforces presence when `requiresStatement` is true.

export async function saveStatementForApplicant(
  applicantUserId: Types.ObjectId,
  statement: string,
): Promise<string> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'APPLICATION_LOCKED', 'Application is locked.');
  }
  const trimmed = (statement ?? '').trim();
  if (trimmed.length > 50_000) {
    throw new HttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      'Statement is too long (max 50,000 characters).',
    );
  }
  // Soft word-limit check vs program config — warn but don't reject. M4
  // submit step enforces hard limits.
  if (application.programId) {
    const program = await Program.findById(application.programId);
    if (program && trimmed && wordCount(trimmed) > program.statementWordLimit * 1.5) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Statement is over the program's word limit (${program.statementWordLimit} words). Trim before saving.`,
      );
    }
  }
  application.statement = trimmed;
  await application.save();
  return application.statement;
}

export async function getStatementForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<string> {
  const application = await Application.findOne({ applicantUserId });
  return application?.statement ?? '';
}

export function wordCount(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}
