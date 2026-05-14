import { Types } from 'mongoose';
import type {
  AddReviewerNoteInput,
  ApplicationConsentsDto,
  ApplicationDecisionInput,
  OfficerApplicationDetailDto,
  ReviewerNoteDto,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Application,
  ApplicationDocument,
  ApplicationDraft,
  Referee,
  ReviewerNote,
  User,
  type HydratedApplication,
  type HydratedReviewerNote,
} from '../../models/index.js';
import {
  toApplicationDocumentDto,
} from './applicationDocumentService.js';
import { toRefereeDto } from './refereeService.js';
import { toApplicationDraftDto } from './applicationDraftService.js';
import { toApplicationDto } from './applicationService.js';
import { appendAdmissionsAudit } from './admissionsAuditService.js';

// M5 — Officer-facing aggregation + decision flow.
//
// `getOfficerApplicationDetail` returns the union of all sections the
// reviewer needs: draft data, documents (with signed URLs to fetch on view),
// referees, statement, consents, and notes. Decision flow (`recordDecision`)
// guards on officer↔program scoping (Plan-agent risk #3) — currently
// implemented as a permissive default, with the scoping hook ready for M5
// follow-up if Logan confirms a program-officer mapping.

export async function getOfficerApplicationDetail(
  applicationId: string,
): Promise<OfficerApplicationDetailDto> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  }
  const app = await Application.findById(applicationId);
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');

  const applicant = await User.findById(app.applicantUserId).select('_id name email');
  const draft = await ApplicationDraft.findOne({ applicationId: app._id });
  const docs = await ApplicationDocument.find({ applicationId: app._id }).sort({ uploadedAt: -1 });
  const referees = await Referee.find({ applicationId: app._id }).sort({ invitedAt: 1 });
  const notes = await ReviewerNote.find({ applicationId: app._id }).sort({ createdAt: 1 });
  const noteAuthorIds = Array.from(new Set(notes.map((n) => n.authorUserId.toString())));
  const noteAuthors = noteAuthorIds.length
    ? await User.find({ _id: { $in: noteAuthorIds } }).select('_id name')
    : [];
  const authorById = new Map(noteAuthors.map((u) => [String(u._id), u.name]));

  const consentsDto: ApplicationConsentsDto = {
    truthfulness: toConsentDto(app.consents.truthfulness),
    terms: toConsentDto(app.consents.terms),
    ferpaNotice: toConsentDto(app.consents.ferpaNotice),
    priorEducationAuth: toConsentDto(app.consents.priorEducationAuth),
    communications: toConsentDto(app.consents.communications),
  };

  const base = toApplicationDto(app, applicant ?? null);

  return {
    ...base,
    draft: draft ? toApplicationDraftDto(draft) : null,
    documents: docs.map(toApplicationDocumentDto),
    referees: referees.map((r) => toRefereeDto(r, true)),
    notes: notes.map((n) =>
      toReviewerNoteDto(n, authorById.get(n.authorUserId.toString()) ?? 'Reviewer'),
    ),
    statement: app.statement || null,
    consents: hasAnyConsent(app) ? consentsDto : null,
  };
}

export async function addReviewerNote(
  applicationId: string,
  actorUserId: Types.ObjectId,
  input: AddReviewerNoteInput,
): Promise<HydratedReviewerNote> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  }
  const app = await Application.findById(applicationId);
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  const body = input.body.trim();
  if (!body) throw new HttpError(422, 'VALIDATION_FAILED', 'Note body is required.');
  if (body.length > 8000) throw new HttpError(422, 'VALIDATION_FAILED', 'Note is too long.');
  const note = await ReviewerNote.create({
    applicationId: app._id,
    authorUserId: actorUserId,
    body,
  });
  await appendAdmissionsAudit({
    applicationId: app._id,
    actorUserId,
    action: 'officer.note_added',
    details: { noteId: String(note._id), preview: body.slice(0, 200) },
  });
  return note;
}

export async function recordDecision(
  applicationId: string,
  actorUserId: Types.ObjectId,
  _actorRole: string,
  input: ApplicationDecisionInput,
): Promise<HydratedApplication> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  }
  const app = await Application.findById(applicationId);
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');

  // Officer↔program scoping (placeholder): Phase 1 doesn't yet have an
  // officer↔program mapping; admins + superadmins always pass. The
  // `_actorRole` parameter is reserved for the M5+ follow-up that wires
  // program-scoped permissions once Logan confirms the mapping shape.

  // State machine — decisions are allowed from submitted/under_review/
  // decision_pending; not from draft/withdrawn/terminal.
  const allowed = new Set(['submitted', 'under_review', 'decision_pending']);
  if (!allowed.has(app.state)) {
    throw new HttpError(409, 'INVALID_STATE', `Cannot decide from state "${app.state}".`);
  }

  // Application-fee gate (M6) — feature-flagged. We import lazily so the
  // M6 service is not a hard dependency for M5 ship.
  // (M5 wires the check; M6 turns it on. For now, no-op.)

  const nextState =
    input.decision === 'admit'
      ? 'admitted'
      : input.decision === 'deny'
        ? 'denied'
        : 'waitlisted';

  app.decision = {
    decision: input.decision,
    decidedAt: new Date(),
    decidedBy: actorUserId,
    reasonInternal: input.reasonInternal?.trim() || null,
    reasonApplicant: input.reasonApplicant?.trim() || null,
  };
  app.state = nextState;
  await app.save();

  const auditAction =
    input.decision === 'admit'
      ? 'officer.decision.admit'
      : input.decision === 'deny'
        ? 'officer.decision.deny'
        : 'officer.decision.waitlist';
  await appendAdmissionsAudit({
    applicationId: app._id,
    actorUserId,
    action: auditAction,
    details: {
      decision: input.decision,
      reasonInternal: input.reasonInternal ?? null,
      reasonApplicant: input.reasonApplicant ?? null,
    },
  });

  return app;
}

export function toReviewerNoteDto(
  doc: HydratedReviewerNote,
  authorName: string,
): ReviewerNoteDto {
  return {
    id: String(doc._id),
    applicationId: doc.applicationId.toString(),
    authorUserId: doc.authorUserId.toString(),
    authorName,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  };
}

function toConsentDto(
  c: { acknowledged: boolean; atUtc: Date | null; version: string },
): { acknowledged: boolean; atUtc: string | null; version: string } {
  return {
    acknowledged: c.acknowledged,
    atUtc: c.atUtc ? c.atUtc.toISOString() : null,
    version: c.version,
  };
}

function hasAnyConsent(app: HydratedApplication): boolean {
  const c = app.consents;
  return Boolean(
    c.truthfulness.acknowledged
      || c.terms.acknowledged
      || c.ferpaNotice.acknowledged
      || c.priorEducationAuth.acknowledged
      || c.communications.acknowledged,
  );
}
