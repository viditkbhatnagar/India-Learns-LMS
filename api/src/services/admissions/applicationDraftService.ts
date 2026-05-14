import type { Types } from 'mongoose';
import type {
  ApplicationDraftDto,
  ApplicationDraftStepName,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Application,
  ApplicationDraft,
  type HydratedApplicationDraft,
} from '../../models/index.js';
import {
  APPLICATION_DRAFT_STEPS,
  type ApplicationDraftStep,
} from '../../models/admissions/applicationDraft.js';

function isStepName(value: unknown): value is ApplicationDraftStep {
  return typeof value === 'string'
    && (APPLICATION_DRAFT_STEPS as readonly string[]).includes(value);
}

export async function getOrCreateDraftForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<HydratedApplicationDraft> {
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  // Submitted/withdrawn applications are immutable; draft writes return 409.
  if (application.state !== 'draft') {
    const existing = await ApplicationDraft.findOne({ applicationId: application._id });
    if (!existing) {
      throw new HttpError(
        409,
        'APPLICATION_LOCKED',
        'Application has been submitted and cannot be edited.',
      );
    }
    return existing;
  }
  let draft = await ApplicationDraft.findOne({ applicationId: application._id });
  if (!draft) {
    draft = await ApplicationDraft.create({
      applicationId: application._id,
      applicantUserId,
      data: {},
      completedSteps: [],
      lastModifiedAt: new Date(),
    });
  }
  return draft;
}

export async function saveDraftStep(
  applicantUserId: Types.ObjectId,
  step: ApplicationDraftStepName,
  payload: unknown,
  markComplete: boolean,
): Promise<HydratedApplicationDraft> {
  if (!isStepName(step)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Unknown step "${String(step)}".`);
  }
  const application = await Application.findOne({ applicantUserId });
  if (!application) {
    throw new HttpError(404, 'NOT_FOUND', 'No application found for this account.');
  }
  if (application.state !== 'draft') {
    throw new HttpError(
      409,
      'APPLICATION_LOCKED',
      'Application has been submitted and cannot be edited.',
    );
  }
  const draft = await getOrCreateDraftForApplicant(applicantUserId);
  // Mongoose's Mixed type needs an explicit markModified on nested writes.
  draft.data = { ...(draft.data ?? {}), [step]: payload };
  draft.markModified('data');
  if (markComplete && !draft.completedSteps.includes(step)) {
    draft.completedSteps = [...draft.completedSteps, step];
  } else if (!markComplete && draft.completedSteps.includes(step)) {
    // If the applicant goes back and edits a step they'd previously marked
    // complete, demote it. This keeps the officer-side progress bar honest.
    draft.completedSteps = draft.completedSteps.filter((s) => s !== step);
  }
  draft.lastModifiedAt = new Date();
  await draft.save();
  return draft;
}

export function toApplicationDraftDto(
  doc: HydratedApplicationDraft,
): ApplicationDraftDto {
  return {
    id: String(doc._id),
    applicationId: doc.applicationId.toString(),
    data: (doc.data ?? {}) as Partial<Record<ApplicationDraftStepName, unknown>>,
    completedSteps: doc.completedSteps as ApplicationDraftStepName[],
    lastModifiedAt: doc.lastModifiedAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
