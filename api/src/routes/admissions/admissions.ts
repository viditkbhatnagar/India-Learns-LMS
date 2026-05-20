import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { PROGRAM_REQUIRED_DOC_TYPES } from 'india-learns-shared-types';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { HttpError } from '../../middleware/error.js';
import { User } from '../../models/index.js';
import {
  applicantSignup,
  findApplicationForApplicant,
  listApplicationsForOfficer,
  toApplicationDto,
} from '../../services/admissions/applicationService.js';
import {
  getOrCreateDraftForApplicant,
  saveDraftStep,
  toApplicationDraftDto,
} from '../../services/admissions/applicationDraftService.js';
import {
  listAdmissionsEnabledPrograms,
  listOpenCohortsForProgram,
} from '../../services/admissions/publicProgramsService.js';
import {
  deleteApplicantDocument,
  listDocumentsForApplicant,
  registerDocumentForApplicant,
  signDocumentUploadForApplicant,
  toApplicationDocumentDto,
} from '../../services/admissions/applicationDocumentService.js';
import {
  getStatementForApplicant,
  saveStatementForApplicant,
} from '../../services/admissions/applicationStatementService.js';
import {
  addReferee,
  deleteReferee,
  listRefereesForApplicant,
  recordRefereeUpload,
  refereeSignUpload,
  resendReferee,
  resolveTokenContext,
  toRefereeDto,
} from '../../services/admissions/refereeService.js';
import {
  submitApplication,
  withdrawApplication,
} from '../../services/admissions/applicationSubmitService.js';
import {
  acceptOffer,
  assignCohort,
  declineOffer,
} from '../../services/admissions/applicantConversionService.js';
import {
  addReviewerNote,
  getOfficerApplicationDetail,
  recordDecision,
  toReviewerNoteDto,
} from '../../services/admissions/officerReviewService.js';
import {
  appendAdmissionsAudit,
  verifyAuditChain,
} from '../../services/admissions/admissionsAuditService.js';
import {
  analyticsToCsv,
  buildAdmissionsAnalytics,
} from '../../services/admissions/admissionsAnalyticsService.js';
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '../../utils/cookies.js';

// M1 — single router file for all M1 admissions routes (public signup,
// applicant portal, officer dashboard). M2+ will split into apply.ts /
// me.ts / officer.ts as the surface grows.

const SignupBody = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  phoneE164: z.string().regex(/^\+\d{6,15}$/),
  password: z.string().min(1).max(256),
  commsOptIn: z.boolean().optional(),
  programId: z.string().min(1).optional(),
  deviceId: z.string().min(1).max(128),
});

const OfficerListQuery = z.object({
  state: z
    .enum([
      'draft',
      'submitted',
      'under_review',
      'decision_pending',
      'admitted',
      'denied',
      'waitlisted',
      'withdrawn',
    ])
    .optional(),
  programId: z.string().min(1).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

function ctx(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
    deviceId:
      typeof req.body?.deviceId === 'string' ? req.body.deviceId : '',
  };
}

const DRAFT_STEP_NAMES = [
  'step2_personal',
  'step3_contact',
  'step4_program',
  'step5_academic',
  'step6_documents',
  'step7_statement',
  'step8_references',
  'step9_consents',
] as const;
const DraftStepEnum = z.enum(DRAFT_STEP_NAMES);

const SaveDraftBody = z.object({
  step: DraftStepEnum,
  payload: z.unknown(),
  markComplete: z.boolean().optional(),
});

// M10 — Reuses the shared program-required doc-type list so SSLC, Plus Two,
// Degree, Transfer Certificate, and Passport Photo are now valid Step-6
// uploads. `referee_letter` is intentionally excluded — that path goes
// through the M3b tokenized referee upload, not this applicant endpoint.
const DocumentTypeEnum = z.enum(PROGRAM_REQUIRED_DOC_TYPES);

const SignDocumentBody = z.object({
  documentType: DocumentTypeEnum,
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

const RegisterDocumentBody = z.object({
  documentType: DocumentTypeEnum,
  label: z.string().max(200).optional(),
  url: z.string().url().max(1024),
  key: z.string().min(1).max(500),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
});

const SaveStatementBody = z.object({
  statement: z.string().max(50_000),
});

const AddRefereeBody = z.object({
  name: z.string().min(1).max(200),
  relationship: z.string().min(1).max(200),
  organization: z.string().min(1).max(200),
  email: z.string().email().max(254),
  phoneE164: z.string().regex(/^\+\d{6,15}$/).nullable().optional(),
});

const RefereeSignBody = z.object({
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

const RefereeUploadBody = z.object({
  url: z.string().url().max(1024),
  key: z.string().min(1).max(500),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
});

const SubmitBody = z.object({
  truthfulness: z.boolean(),
  terms: z.boolean(),
  ferpaNotice: z.boolean(),
  priorEducationAuth: z.boolean(),
  communications: z.boolean(),
});

const WithdrawBody = z.object({
  reason: z.string().max(1000).optional(),
});

const AddNoteBody = z.object({
  body: z.string().min(1).max(8000),
});

const DecisionBody = z.object({
  decision: z.enum(['admit', 'deny', 'waitlist']),
  reasonInternal: z.string().max(2000).optional(),
  reasonApplicant: z.string().max(2000).optional(),
});

const AssignCohortBody = z.object({
  batchId: z.string().min(1),
});

const DeclineBody = z.object({
  reason: z.string().max(1000).optional(),
});

/** Mounted at `/v1/admissions/apply` — public, unauthenticated. */
export function applyRouter(): Router {
  const router = Router();

  router.get(
    '/programs',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listAdmissionsEnabledPrograms();
        res.status(200).json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/programs/:programId/cohorts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listOpenCohortsForProgram(req.params.programId ?? '');
        res.status(200).json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/signup',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SignupBody.parse(req.body);
        const result = await applicantSignup(
          {
            email: body.email,
            name: body.name,
            phoneE164: body.phoneE164,
            password: body.password,
            commsOptIn: body.commsOptIn,
            programId: body.programId,
          },
          { ...ctx(req), deviceId: body.deviceId },
        );
        res.cookie(
          REFRESH_COOKIE_NAME,
          result.refreshToken,
          refreshCookieOptions(),
        );
        res.status(201).json({
          data: {
            application: toApplicationDto(result.application, {
              name: result.user.name,
              email: result.user.email,
            }),
            accessToken: result.accessToken,
            accessTokenExpiresIn: result.accessTokenExpiresIn,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mounted at `/v1/admissions/me` — applicant-authenticated. */
export function meAdmissionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('applicant'));

  router.get(
    '/application',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findApplicationForApplicant(req.auth!.userId);
        res.status(200).json({
          data: {
            application: toApplicationDto(doc, {
              name: req.auth!.user.name,
              email: req.auth!.user.email,
            }),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/draft',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const draft = await getOrCreateDraftForApplicant(req.auth!.userId);
        res.status(200).json({ data: { draft: toApplicationDraftDto(draft) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.put(
    '/draft',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SaveDraftBody.parse(req.body);
        const draft = await saveDraftStep(
          req.auth!.userId,
          body.step,
          body.payload,
          body.markComplete ?? false,
        );
        res.status(200).json({ data: { draft: toApplicationDraftDto(draft) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // M3a — documents.
  router.post(
    '/documents/sign-upload',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SignDocumentBody.parse(req.body);
        const ticket = await signDocumentUploadForApplicant(req.auth!.userId, body);
        res.status(200).json({ data: { ticket } });
      } catch (err) {
        next(err);
      }
    },
  );
  router.post(
    '/documents',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RegisterDocumentBody.parse(req.body);
        const doc = await registerDocumentForApplicant(req.auth!.userId, body);
        res.status(201).json({ data: { document: toApplicationDocumentDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );
  router.get(
    '/documents',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await listDocumentsForApplicant(req.auth!.userId);
        res.status(200).json({
          data: { items: docs.map(toApplicationDocumentDto) },
        });
      } catch (err) {
        next(err);
      }
    },
  );
  router.delete(
    '/documents/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteApplicantDocument(req.auth!.userId, req.params.id ?? '');
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // M3a — statement.
  router.get(
    '/statement',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const statement = await getStatementForApplicant(req.auth!.userId);
        res.status(200).json({ data: { statement } });
      } catch (err) {
        next(err);
      }
    },
  );
  router.put(
    '/statement',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SaveStatementBody.parse(req.body);
        const statement = await saveStatementForApplicant(req.auth!.userId, body.statement);
        res.status(200).json({ data: { statement } });
      } catch (err) {
        next(err);
      }
    },
  );

  // M3b — referees.
  router.get(
    '/referees',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listRefereesForApplicant(req.auth!.userId);
        res.status(200).json({
          data: { items: items.map((r) => toRefereeDto(r)) },
        });
      } catch (err) {
        next(err);
      }
    },
  );
  router.post(
    '/referees',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AddRefereeBody.parse(req.body);
        const ref = await addReferee(req.auth!.userId, {
          name: body.name,
          relationship: body.relationship,
          organization: body.organization,
          email: body.email,
          phoneE164: body.phoneE164 ?? null,
        });
        res.status(201).json({ data: { referee: toRefereeDto(ref) } });
      } catch (err) {
        next(err);
      }
    },
  );
  router.post(
    '/referees/:id/resend',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ref = await resendReferee(req.auth!.userId, req.params.id ?? '');
        res.status(200).json({ data: { referee: toRefereeDto(ref) } });
      } catch (err) {
        next(err);
      }
    },
  );
  router.delete(
    '/referees/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteReferee(req.auth!.userId, req.params.id ?? '');
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // M4 — submit / withdraw.
  router.post(
    '/application/submit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SubmitBody.parse(req.body);
        const updated = await submitApplication(req.auth!.userId, body);
        res.status(200).json({
          data: {
            application: toApplicationDto(updated, {
              name: req.auth!.user.name,
              email: req.auth!.user.email,
            }),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/application/withdraw',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = WithdrawBody.parse(req.body ?? {});
        const updated = await withdrawApplication(req.auth!.userId, body);
        res.status(200).json({
          data: {
            application: toApplicationDto(updated, {
              name: req.auth!.user.name,
              email: req.auth!.user.email,
            }),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // M7 — accept / decline an admit offer. Accept triggers the applicant →
  // student conversion (atomic seat decrement + role flip + IL-YYYY-NNNN
  // mint + enrollment rows). The applicant's role flips to `student` after
  // a successful accept, so subsequent calls to /me/application return 403
  // — they live in the student portal now.
  router.post(
    '/application/accept',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await acceptOffer(req.auth!.userId);
        res.status(200).json({
          data: {
            studentCode: result.studentCode,
            enrollmentIds: result.enrollmentIds,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/application/decline',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = DeclineBody.parse(req.body ?? {});
        const updated = await declineOffer(req.auth!.userId, body.reason);
        res.status(200).json({
          data: {
            application: toApplicationDto(updated, {
              name: req.auth!.user.name,
              email: req.auth!.user.email,
            }),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mounted at `/v1/admissions/referee` — PUBLIC. Validated by token. */
export function refereeRouter(): Router {
  const router = Router();

  router.get(
    '/:token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { context } = await resolveTokenContext(req.params.token ?? '');
        res.status(200).json({ data: { context } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:token/sign-upload',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RefereeSignBody.parse(req.body);
        const ticket = await refereeSignUpload(req.params.token ?? '', body);
        res.status(200).json({ data: { ticket } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:token/upload',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RefereeUploadBody.parse(req.body);
        await recordRefereeUpload(req.params.token ?? '', body);
        res.status(200).json({ data: { ok: true } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mounted at `/v1/admissions/officer` — admissions officer + admin. */
export function officerAdmissionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('admissions_officer', 'admin', 'superadmin'));

  router.get(
    '/applications',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = OfficerListQuery.parse(req.query);
        const result = await listApplicationsForOfficer(query);
        res.status(200).json({
          data: {
            items: result.items,
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/applications/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const detail = await getOfficerApplicationDetail(req.params.id ?? '');
        await appendAdmissionsAudit({
          applicationId: new Types.ObjectId(detail.id),
          actorUserId: req.auth!.userId,
          action: 'officer.viewed_application',
          details: null,
        });
        res.status(200).json({ data: { application: detail } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/applications/:id/notes',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AddNoteBody.parse(req.body);
        const note = await addReviewerNote(
          req.params.id ?? '',
          req.auth!.userId,
          body,
        );
        res.status(201).json({
          data: {
            note: toReviewerNoteDto(note, req.auth!.user.name),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/applications/:id/decision',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = DecisionBody.parse(req.body);
        const updated = await recordDecision(
          req.params.id ?? '',
          req.auth!.userId,
          req.auth!.role,
          body,
        );
        const applicant = await User.findById(updated.applicantUserId)
          .select('_id name email')
          .lean();
        res.status(200).json({
          data: {
            application: toApplicationDto(updated, applicant ?? null),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/applications/:id/audit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!id || !Types.ObjectId.isValid(id)) {
          throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
        }
        const chain = await verifyAuditChain(new Types.ObjectId(id));
        res.status(200).json({ data: chain });
      } catch (err) {
        next(err);
      }
    },
  );

  // M8 — funnel analytics for the officer dashboard. Cheap aggregations
  // (no per-doc scans of audit chain) so it's fine to hit on every dashboard
  // load. CSV export shape matches the JSON one.
  router.get(
    '/analytics',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const analytics = await buildAdmissionsAnalytics();
        res.status(200).json({ data: analytics });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/analytics.csv',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const analytics = await buildAdmissionsAnalytics();
        const csv = analyticsToCsv(analytics);
        res.setHeader('content-type', 'text/csv; charset=utf-8');
        res.setHeader(
          'content-disposition',
          `attachment; filename="admissions-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
        );
        res.status(200).send(csv);
      } catch (err) {
        next(err);
      }
    },
  );

  // M7 — officer assigns a cohort for program_only programs (only effective
  // before the applicant accepts; ignored for cohort_pick programs).
  router.post(
    '/applications/:id/assign-cohort',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = AssignCohortBody.parse(req.body);
        const updated = await assignCohort(
          req.params.id ?? '',
          req.auth!.userId,
          body.batchId,
        );
        const applicant = await User.findById(updated.applicantUserId)
          .select('_id name email')
          .lean();
        res.status(200).json({
          data: {
            application: toApplicationDto(updated, applicant ?? null),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
