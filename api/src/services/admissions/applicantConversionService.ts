import { Types } from 'mongoose';
import type {
  AcceptOfferResult,
  ApplicationDraftStep2Personal,
  ApplicationDraftStep3Contact,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Application,
  ApplicationDraft,
  Batch,
  Course,
  Enrollment,
  Program,
  User,
  type HydratedApplication,
} from '../../models/index.js';
import { nextUserCode } from '../counterService.js';
import { recordAudit } from '../auditService.js';
import { appendAdmissionsAudit } from './admissionsAuditService.js';

// M10 — Copy the personal-detail fields captured at apply time
// (ApplicationDraft step2_personal + step3_contact) onto the User doc.
// Each block is best-effort: a missing/malformed step doesn't block the
// conversion, it just leaves that User field null for the student to fill
// in via the Profile screen later.
// Exported so the one-time backfill script (api/scripts/backfill-personal-details.ts)
// can reuse the same logic — keeps the conversion path and the backfill
// path from drifting.
export function copyPersonalDetailsFromDraft(
  draftData: Record<string, unknown>,
  user: {
    name: string;
    dateOfBirth: Date | null;
    personalAddress: unknown;
    emergencyContact: unknown;
    parentGuardian: unknown;
  },
): void {
  const step2 = draftData.step2_personal as Partial<ApplicationDraftStep2Personal> | undefined;
  const step3 = draftData.step3_contact as Partial<ApplicationDraftStep3Contact> | undefined;

  // Date of birth — Step 2 stores ISO date (YYYY-MM-DD). Persist as UTC
  // midnight Date so the toDto slug renders deterministically.
  if (user.dateOfBirth === null && step2?.dateOfBirthIst) {
    const slug = step2.dateOfBirthIst.slice(0, 10);
    const parsed = new Date(`${slug}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      user.dateOfBirth = parsed;
    }
  }

  // Prefer the applicant's legal name combo on the User if the User name
  // still matches the freeform signup name (rare collision risk; this is
  // a no-op if an admin already curated User.name).
  if (step2?.legalFirstName && step2.legalLastName) {
    const composed = [step2.legalFirstName, step2.middleName, step2.legalLastName]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
      .join(' ');
    if (composed && user.name.trim() !== composed) {
      // Don't overwrite — admins may have edited the signup name. The
      // student can update their own name from the Profile screen.
    }
  }

  // Structured address — copied as-is. The DocSlot validates required
  // fields at upload time; here we trust the draft (step3 won't have
  // marked complete without these).
  if (user.personalAddress == null && step3?.address) {
    const addr = step3.address;
    if (addr.street && addr.city && addr.country) {
      user.personalAddress = {
        street: addr.street,
        city: addr.city,
        stateProvince: addr.stateProvince ?? '',
        postalCode: addr.postalCode ?? '',
        country: addr.country,
      };
    }
  }

  // Emergency contact — step3 emergency block.
  if (user.emergencyContact == null && step3?.emergency) {
    const em = step3.emergency;
    if (em.name && em.phoneE164) {
      user.emergencyContact = {
        name: em.name,
        relationship: em.relationship ?? '',
        phoneE164: em.phoneE164,
        email: null,
      };
    }
  }

  // Parent/guardian — optional step3 block added in M10. Falls back to
  // null when the applicant didn't fill it; student can add later.
  if (user.parentGuardian == null && step3?.parentGuardian) {
    const pg = step3.parentGuardian;
    if (pg.name && pg.phoneE164) {
      user.parentGuardian = {
        name: pg.name,
        relationship: pg.relationship ?? '',
        phoneE164: pg.phoneE164,
        email: pg.email ?? null,
      };
    }
  }
}

// M7 — Applicant → Student conversion.
//
// Two-step flow:
//   1. Officer admits (M5 decision endpoint sets state='admitted').
//   2. Applicant accepts the offer at the portal → this service runs.
//
// Order of operations matters: we decrement the cohort seat atomically
// FIRST so a race on the last seat resolves cleanly. If the seat decrement
// fails, no User mutation happens and the applicant gets a 409.

export async function acceptOffer(
  applicantUserId: Types.ObjectId,
): Promise<AcceptOfferResult> {
  const app = await Application.findOne({ applicantUserId });
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'No application found.');
  if (app.state !== 'admitted') {
    throw new HttpError(
      409,
      'NOT_ADMITTED',
      `Cannot accept — application is in state "${app.state}".`,
    );
  }
  if (!app.programId) {
    throw new HttpError(409, 'PROGRAM_MISSING', 'Application has no program.');
  }
  if (!app.batchId) {
    throw new HttpError(
      409,
      'COHORT_NOT_ASSIGNED',
      'Cohort has not been assigned to your application yet. Contact admissions.',
    );
  }

  // Atomic seat decrement — refuses if 0 seats remain.
  const claimedBatch = await Batch.findOneAndUpdate(
    { _id: app.batchId, seatsRemaining: { $gt: 0 }, deletedAt: null },
    { $inc: { seatsRemaining: -1 } },
    { new: true },
  );
  if (!claimedBatch) {
    throw new HttpError(
      409,
      'COHORT_FULL',
      'The cohort is now full. Contact admissions for a different cohort.',
    );
  }

  let createdEnrollmentIds: Types.ObjectId[] = [];
  let studentCode = '';
  try {
    const user = await User.findById(applicantUserId);
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'User not found.');
    const program = await Program.findById(app.programId);
    if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');

    // Mint student code only if the user doesn't already have one (idempotency).
    if (!user.code) {
      const year = new Date().getUTCFullYear();
      user.code = await nextUserCode(year);
    }
    studentCode = user.code;
    user.role = 'student';
    user.programId = app.programId;
    user.batchId = app.batchId;
    // Validity window matches the batch.
    user.enrolmentValidFrom = claimedBatch.startDate;
    user.enrolmentValidTo = claimedBatch.endDate;
    user.status = user.status === 'pending' ? 'active' : user.status;

    // M10 — Lift personal details from the applicant's draft onto the
    // student User doc so the Profile screen can render them immediately
    // post-acceptance. Best-effort: a missing draft is fine (existing
    // students predate M10 anyway). We only fill fields that are still
    // null, so an admin who already curated the User doc isn't overwritten.
    const draft = await ApplicationDraft.findOne({ applicantUserId });
    if (draft?.data && typeof draft.data === 'object') {
      copyPersonalDetailsFromDraft(draft.data as Record<string, unknown>, user);
    }

    await user.save();

    // Create one Enrollment per course in the program. If the program has
    // no courses yet (admissions can technically run on a program without
    // courses), we still flip the role but skip enrollment creation. M5+
    // assumes course setup is done before admissions opens.
    const courses = await Course.find({ programId: program._id, deletedAt: null });
    if (courses.length > 0) {
      const validFrom = claimedBatch.startDate;
      const validTo = claimedBatch.endDate;
      const created = await Promise.all(
        courses.map((course) =>
          Enrollment.create({
            studentId: user._id,
            batchId: claimedBatch._id,
            courseId: course._id,
            programId: program._id,
            validFrom,
            validTo,
            status: 'active',
            accessState: 'active',
          }),
        ),
      );
      createdEnrollmentIds = created.map((d) => d._id);
      await Promise.all(
        created.map((doc) =>
          recordAudit({
            actorUserId: user._id,
            action: 'enrollment.created',
            targetType: 'Enrollment',
            targetId: doc._id,
            before: null,
            after: doc.toObject(),
            ip: '',
            ua: '',
          }),
        ),
      );
    }

    await appendAdmissionsAudit({
      applicationId: app._id,
      actorUserId: applicantUserId,
      action: 'applicant.offer.accepted',
      details: {
        studentCode,
        batchId: app.batchId.toString(),
        enrollmentIds: createdEnrollmentIds.map((id) => id.toString()),
      },
    });
    await appendAdmissionsAudit({
      applicationId: app._id,
      actorUserId: applicantUserId,
      action: 'applicant.converted_to_student',
      details: { studentCode, programId: program._id.toString() },
    });
    return {
      studentCode,
      enrollmentIds: createdEnrollmentIds.map((id) => id.toString()),
    };
  } catch (err) {
    // Roll back the seat decrement on any downstream failure so the cohort
    // count stays consistent.
    await Batch.updateOne(
      { _id: claimedBatch._id },
      { $inc: { seatsRemaining: 1 } },
    );
    throw err;
  }
}

export async function declineOffer(
  applicantUserId: Types.ObjectId,
  reason: string | undefined,
): Promise<HydratedApplication> {
  const app = await Application.findOne({ applicantUserId });
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'No application found.');
  if (app.state !== 'admitted') {
    throw new HttpError(
      409,
      'NOT_ADMITTED',
      `Cannot decline — application is in state "${app.state}".`,
    );
  }
  // Decline before accept doesn't need a seat increment because the seat
  // wasn't claimed yet. (Accept does the atomic decrement; decline never
  // touches the seat.)
  app.state = 'withdrawn';
  app.withdrawnAt = new Date();
  app.withdrawnReason = reason?.trim() || 'Offer declined by applicant';
  await app.save();
  await appendAdmissionsAudit({
    applicationId: app._id,
    actorUserId: applicantUserId,
    action: 'applicant.offer.declined',
    details: { reason: app.withdrawnReason },
  });
  return app;
}

// Officer side — for program_only programs, the officer assigns a batch
// after admitting. Stamps Application.batchId; the actual seat claim
// happens when the applicant accepts.

export async function assignCohort(
  applicationId: string,
  actorUserId: Types.ObjectId,
  batchId: string,
): Promise<HydratedApplication> {
  if (!Types.ObjectId.isValid(applicationId) || !Types.ObjectId.isValid(batchId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Not found.');
  }
  const app = await Application.findById(applicationId);
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  if (!app.programId) {
    throw new HttpError(409, 'PROGRAM_MISSING', 'Application has no program.');
  }
  const batch = await Batch.findById(batchId);
  if (!batch || batch.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  }
  if (!batch.programId.equals(app.programId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Batch does not belong to the application\'s program.',
    );
  }
  if (!batch.openForApplications) {
    throw new HttpError(
      409,
      'COHORT_CLOSED',
      'Batch is not open for applications.',
    );
  }
  if (batch.seatsRemaining <= 0) {
    throw new HttpError(409, 'COHORT_FULL', 'Batch has no seats remaining.');
  }
  app.batchId = batch._id;
  await app.save();
  await appendAdmissionsAudit({
    applicationId: app._id,
    actorUserId,
    action: 'officer.viewed_application',
    details: { assignedCohort: String(batch._id) },
  });
  return app;
}
