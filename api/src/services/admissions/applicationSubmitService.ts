import { Types } from 'mongoose';
import type {
  ApplicationState,
  SubmitApplicationInput,
  WithdrawApplicationInput,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import { logger } from '../../config/logger.js';
import { getIntegrations } from '../../integrations/index.js';
import {
  Application,
  ApplicationDocument,
  ApplicationDraft,
  Program,
  Referee,
  User,
  type HydratedApplication,
} from '../../models/index.js';

const CONSENT_VERSION = 'v1-2026-05';

// M4 — Submit transitions Application from `draft` to `submitted`.
//
// Strict validation here is the bouncer for the entire form: the draft has
// been holding loose JSON; this function asserts the shape needed by the
// reviewer workflow. Any missing required item returns 422 with a list of
// what's missing.

export async function submitApplication(
  applicantUserId: Types.ObjectId,
  input: SubmitApplicationInput,
): Promise<HydratedApplication> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(409, 'ALREADY_SUBMITTED', 'Application has already been submitted.');
  }
  // Each consent must be true at submit-time.
  const consentInputs: (keyof SubmitApplicationInput)[] = [
    'truthfulness',
    'terms',
    'ferpaNotice',
    'priorEducationAuth',
    'communications',
  ];
  const missing: string[] = [];
  for (const key of consentInputs) {
    if (!input[key]) missing.push(`consent.${key}`);
  }

  const draft = await ApplicationDraft.findOne({ applicationId: application._id });
  const data = (draft?.data ?? {}) as Record<string, Record<string, unknown> | unknown[] | undefined>;
  const step2 = data.step2_personal as Record<string, unknown> | undefined;
  const step3 = data.step3_contact as Record<string, unknown> | undefined;
  const step4 = data.step4_program as Record<string, unknown> | undefined;
  const step5 = data.step5_academic as unknown[] | undefined;

  if (!step2 || !step2.legalFirstName || !step2.legalLastName || !step2.dateOfBirthIst || !step2.citizenship) {
    missing.push('step2_personal');
  }
  if (
    !step3
    || !step3.mobilePhoneE164
    || typeof step3.address !== 'object'
    || !(step3.address as Record<string, unknown>)?.street
    || !(step3.address as Record<string, unknown>)?.city
    || !(step3.address as Record<string, unknown>)?.country
    || typeof step3.emergency !== 'object'
    || !(step3.emergency as Record<string, unknown>)?.name
  ) {
    missing.push('step3_contact');
  }
  const programId = step4?.programId as string | undefined;
  if (!programId) missing.push('step4_program');
  if (!step5 || step5.length === 0) missing.push('step5_academic');

  let program = null;
  if (programId && Types.ObjectId.isValid(programId)) {
    program = await Program.findById(programId);
  }
  if (!program) {
    missing.push('program_unknown');
  } else {
    // Required documents
    const docs = await ApplicationDocument.find({
      applicationId: application._id,
      uploadedByRole: 'applicant',
    });
    const haveByType = new Set(docs.map((d) => d.documentType));
    for (const req of program.requiredDocs) {
      if (req.required && !haveByType.has(req.documentType)) {
        missing.push(`document.${req.documentType}`);
      }
    }
    if (program.requiresStatement && (!application.statement || application.statement.trim().length === 0)) {
      missing.push('statement');
    }
    if (program.requiresReferences) {
      const refsUploaded = await Referee.countDocuments({
        applicationId: application._id,
        status: 'uploaded',
      });
      const minNeeded = program.referencesMinCount;
      if (refsUploaded < minNeeded) {
        missing.push(`references.minCount(${minNeeded})`);
      }
    }
    if (program.admissionMode === 'cohort_pick' && !step4?.batchId) {
      missing.push('step4_cohort');
    }
  }

  if (missing.length > 0) {
    throw new HttpError(
      422,
      'INCOMPLETE_APPLICATION',
      `Cannot submit — missing: ${missing.join(', ')}`,
      { missing },
    );
  }

  const now = new Date();
  const stamp = (acknowledged: boolean) => ({
    acknowledged,
    atUtc: acknowledged ? now : null,
    version: CONSENT_VERSION,
  });
  application.consents = {
    truthfulness: stamp(input.truthfulness),
    terms: stamp(input.terms),
    ferpaNotice: stamp(input.ferpaNotice),
    priorEducationAuth: stamp(input.priorEducationAuth),
    communications: stamp(input.communications),
  };
  application.ferpaAnnualAckAtUtc = now;
  application.programId = programId
    ? new Types.ObjectId(programId)
    : application.programId;
  if (step4?.batchId && typeof step4.batchId === 'string' && Types.ObjectId.isValid(step4.batchId)) {
    application.batchId = new Types.ObjectId(step4.batchId);
  }
  application.state = 'submitted';
  application.submittedAt = now;
  await application.save();

  // M6 — auto-create the ApplicationFee row using program.applicationFeePaise.
  // Free programs (fee 0) get marked paid immediately so the admit gate is
  // non-blocking.
  const { ensureFeeForApplication } = await import('./applicationFeeService.js');
  await ensureFeeForApplication(application._id);

  // Fire status-change notification (email). Best-effort; don't block on
  // failures since the audit row is the source of truth.
  await maybeSendStatusEmail(application, 'submitted');
  return application;
}

export async function withdrawApplication(
  applicantUserId: Types.ObjectId,
  input: WithdrawApplicationInput,
): Promise<HydratedApplication> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  const TERMINAL: ApplicationState[] = ['admitted', 'denied', 'withdrawn'];
  if (TERMINAL.includes(application.state)) {
    throw new HttpError(409, 'ALREADY_TERMINAL', 'Application is already in a terminal state.');
  }
  application.state = 'withdrawn';
  application.withdrawnAt = new Date();
  application.withdrawnReason = input.reason?.trim() || null;
  await application.save();
  await maybeSendStatusEmail(application, 'withdrawn');
  return application;
}

async function maybeSendStatusEmail(
  application: HydratedApplication,
  newState: ApplicationState,
): Promise<void> {
  try {
    const applicant = await User.findById(application.applicantUserId).select('name email');
    if (!applicant) return;
    const { email } = getIntegrations();
    const subjectByState: Record<ApplicationState, string> = {
      draft: 'Your application draft has been saved',
      submitted: 'Your India Learns application is submitted',
      under_review: 'Your India Learns application is under review',
      decision_pending: 'Your India Learns application — decision pending',
      admitted: 'You\'ve been admitted to India Learns',
      denied: 'India Learns admissions decision',
      waitlisted: 'You\'re on the India Learns waitlist',
      withdrawn: 'Your India Learns application has been withdrawn',
    };
    const body = `Hi ${applicant.name},\n\nYour application ${application.code} is now in state: ${newState.replace(/_/g, ' ')}.\n\nYou can check status anytime in your portal.\n\n— India Learns Admissions`;
    await email.send({
      to: applicant.email,
      subject: subjectByState[newState],
      html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
      text: body,
      tag: `admission-${newState}`,
      vars: { name: applicant.name, code: application.code, state: newState },
    });
  } catch (err) {
    logger.warn({ err }, 'admission.status_email.failed');
  }
}
