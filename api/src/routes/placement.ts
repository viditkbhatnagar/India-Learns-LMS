import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  JOB_APPLICATION_STATUSES,
  JOB_EMPLOYMENT_TYPES,
  JOB_POSTING_STATES,
} from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  applyToJob,
  buildPlacementAnalytics,
  createCompany,
  createJobPosting,
  getJobPostingById,
  listApplicationsForPosting,
  listApplicationsForStudent,
  listCompanies,
  listJobPostings,
  softDeleteCompany,
  softDeleteJobPosting,
  updateApplicationStatus,
  updateCompany,
  updateJobPosting,
  withdrawApplication,
} from '../services/placementService.js';

// M10f — Placement / Jobs routes (LMS_Requirements §3).
//
// Surface layout:
//   /v1/companies                — admin CRUD; GET visible to staff + students
//   /v1/jobs                     — admin CRUD; student GET filters to published
//   /v1/jobs/:id/apply           — student
//   /v1/jobs/:id/applications    — admin
//   /v1/me/job-applications      — student's own
//   /v1/job-applications/:id     — admin status PATCH; student DELETE = withdraw
//   /v1/placement/analytics      — admin dashboard

// --------- Zod schemas ------------------------------------------------

const CreateCompanyBody = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/),
  description: z.string().max(4000).optional(),
  website: z.string().url().max(500).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  hqLocation: z.string().max(200).nullable().optional(),
});
const UpdateCompanyBody = CreateCompanyBody.partial();

const CreateJobBody = z.object({
  companyId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  location: z.string().max(200),
  employmentType: z.enum(JOB_EMPLOYMENT_TYPES),
  minSalaryPaise: z.number().int().nonnegative().nullable().optional(),
  maxSalaryPaise: z.number().int().nonnegative().nullable().optional(),
  eligibility: z.string().max(2000).optional(),
  targetProgramIds: z.array(z.string().min(1)).optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
});
const UpdateJobBody = CreateJobBody.partial().extend({
  state: z.enum(JOB_POSTING_STATES).optional(),
});

const ApplyBody = z.object({
  resumeUrl: z.string().url().max(1024).nullable().optional(),
  coverNote: z.string().max(4000).optional(),
});

const UpdateApplicationBody = z.object({
  status: z.enum(JOB_APPLICATION_STATUSES),
  interviewNote: z.string().max(2000).nullable().optional(),
  // M10l — Structured interview scheduling. Pass an ISO timestamp +
  // free-text location when flipping status to interview_scheduled.
  interviewAt: z.string().datetime().nullable().optional(),
  interviewLocation: z.string().max(240).nullable().optional(),
});

// Roles that can manage the placement directory + postings. `admin` and
// `superadmin` are obvious; `admissions_officer` is included because the
// LUC placement team often sits under admissions in small institutions.
const PLACEMENT_ADMIN_ROLES = ['admin', 'superadmin', 'admissions_officer'] as const;

// --------- /v1/companies ----------------------------------------------

export function companiesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Anyone signed in can list companies (students browse them too).
  router.get('/', async (_req, res, next) => {
    try {
      const items = await listCompanies();
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateCompanyBody.parse(req.body);
        const company = await createCompany(body);
        res.status(201).json({ data: { company } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateCompanyBody.parse(req.body);
        const company = await updateCompany(req.params.id ?? '', body);
        res.status(200).json({ data: { company } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await softDeleteCompany(req.params.id ?? '');
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

// --------- /v1/jobs (postings + nested applications) ------------------

export function jobsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // GET — list. Students see only published; staff see all.
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isStaff = ['admin', 'superadmin', 'admissions_officer', 'faculty'].includes(
        req.auth!.role,
      );
      const items = await listJobPostings({
        publicOnly: !isStaff,
        forProgramId: !isStaff
          ? (req.auth!.user.programId?.toString() ?? undefined)
          : undefined,
        state: isStaff
          ? (req.query.state as 'draft' | 'published' | 'closed' | undefined)
          : undefined,
        companyId: req.query.companyId ? String(req.query.companyId) : undefined,
      });
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const posting = await getJobPostingById(req.params.id ?? '');
      // Students may only view published postings via this route.
      if (
        !['admin', 'superadmin', 'admissions_officer', 'faculty'].includes(
          req.auth!.role,
        ) &&
        posting.state !== 'published'
      ) {
        throw new HttpError(404, 'NOT_FOUND', 'Job posting not found.');
      }
      res.status(200).json({ data: { posting } });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateJobBody.parse(req.body);
        const posting = await createJobPosting(body, req.auth!.userId);
        res.status(201).json({ data: { posting } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateJobBody.parse(req.body);
        const posting = await updateJobPosting(req.params.id ?? '', body);
        res.status(200).json({ data: { posting } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await softDeleteJobPosting(req.params.id ?? '');
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // Student apply.
  router.post(
    '/:id/apply',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = ApplyBody.parse(req.body);
        const application = await applyToJob(
          req.params.id ?? '',
          req.auth!.userId,
          body,
        );
        res.status(201).json({ data: { application } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Admin pulls all applications for a posting.
  router.get(
    '/:id/applications',
    requireRole(...PLACEMENT_ADMIN_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listApplicationsForPosting(req.params.id ?? '');
        res.status(200).json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

// --------- /v1/me/job-applications + /v1/job-applications/:id ---------

export function meJobApplicationsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listApplicationsForStudent(req.auth!.userId);
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const application = await withdrawApplication(
          req.params.id ?? '',
          req.auth!.userId,
        );
        res.status(200).json({ data: { application } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export function jobApplicationsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole(...PLACEMENT_ADMIN_ROLES));

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = UpdateApplicationBody.parse(req.body);
      const application = await updateApplicationStatus(req.params.id ?? '', body);
      res.status(200).json({ data: { application } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// --------- /v1/placement/analytics ------------------------------------

export function placementAnalyticsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole(...PLACEMENT_ADMIN_ROLES));

  router.get('/', async (_req, res, next) => {
    try {
      const analytics = await buildPlacementAnalytics();
      res.status(200).json({ data: analytics });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
