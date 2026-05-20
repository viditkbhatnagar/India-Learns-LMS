import { Types } from 'mongoose';
import {
  JOB_APPLICATION_STATUSES,
  type ApplyToJobInput,
  type CompanyDto,
  type CreateCompanyInput,
  type CreateJobPostingInput,
  type JobApplicationDto,
  type JobApplicationStatus,
  type JobEmploymentType,
  type JobPostingDto,
  type JobPostingState,
  type PlacementAnalyticsDto,
  type UpdateCompanyInput,
  type UpdateJobApplicationInput,
  type UpdateJobPostingInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import { enqueueNotification } from './notificationService.js';
import {
  Company,
  Enrollment,
  JobApplication,
  JobPosting,
  Program,
  User,
  type HydratedCompany,
  type HydratedJobApplication,
  type HydratedJobPosting,
} from '../models/index.js';

// M10f — Placement / Jobs service (LMS_Requirements §3).
//
// Three resources — Company, JobPosting, JobApplication — plus a
// derived analytics roll-up. Soft-deletes via `deletedAt` mean admins
// can retire companies while keeping past postings + applications
// visible.

// --------- DTO helpers -------------------------------------------------

function toCompanyDto(doc: HydratedCompany): CompanyDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    name: json.name as string,
    slug: json.slug as string,
    description: (json.description as string) ?? '',
    website: (json.website as string | null) ?? null,
    contactEmail: (json.contactEmail as string | null) ?? null,
    contactPhone: (json.contactPhone as string | null) ?? null,
    industry: (json.industry as string | null) ?? null,
    hqLocation: (json.hqLocation as string | null) ?? null,
    createdAt: (json.createdAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
    updatedAt: (json.updatedAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
    deletedAt: json.deletedAt ? (json.deletedAt as Date).toISOString() : null,
  };
}

interface JobPostingDtoCtx {
  companyName?: string | null;
  applicantCount?: number;
}

function toJobPostingDto(
  doc: HydratedJobPosting,
  ctx: JobPostingDtoCtx = {},
): JobPostingDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    companyId: String(json.companyId),
    companyName: ctx.companyName ?? null,
    title: json.title as string,
    description: (json.description as string) ?? '',
    location: (json.location as string) ?? '',
    employmentType: json.employmentType as JobEmploymentType,
    minSalaryPaise: (json.minSalaryPaise as number | null) ?? null,
    maxSalaryPaise: (json.maxSalaryPaise as number | null) ?? null,
    eligibility: (json.eligibility as string) ?? '',
    targetProgramIds: ((json.targetProgramIds as Types.ObjectId[]) ?? []).map(String),
    applicationDeadline: json.applicationDeadline
      ? (json.applicationDeadline as Date).toISOString()
      : null,
    postedByUserId: String(json.postedByUserId),
    state: json.state as JobPostingState,
    applicantCount: ctx.applicantCount ?? 0,
    createdAt: (json.createdAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
    updatedAt: (json.updatedAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
    deletedAt: json.deletedAt ? (json.deletedAt as Date).toISOString() : null,
  };
}

interface JobApplicationDtoCtx {
  studentName?: string | null;
  studentCode?: string | null;
}

function toJobApplicationDto(
  doc: HydratedJobApplication,
  ctx: JobApplicationDtoCtx = {},
): JobApplicationDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    jobPostingId: String(json.jobPostingId),
    studentId: String(json.studentId),
    studentName: ctx.studentName ?? null,
    studentCode: ctx.studentCode ?? null,
    resumeUrl: (json.resumeUrl as string | null) ?? null,
    coverNote: (json.coverNote as string) ?? '',
    status: json.status as JobApplicationStatus,
    interviewNote: (json.interviewNote as string | null) ?? null,
    appliedAt: (json.appliedAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
    updatedAt: (json.updatedAt as Date)?.toISOString?.() ?? new Date(0).toISOString(),
  };
}

function ensureObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

// --------- Companies --------------------------------------------------

export async function listCompanies(): Promise<CompanyDto[]> {
  const docs = await Company.find({ deletedAt: null }).sort({ name: 1 });
  return docs.map(toCompanyDto);
}

export async function createCompany(
  input: CreateCompanyInput,
): Promise<CompanyDto> {
  const existing = await Company.findOne({ slug: input.slug });
  if (existing) {
    throw new HttpError(409, 'CONFLICT', 'A company with this slug already exists.');
  }
  const doc = await Company.create({
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description?.trim() ?? '',
    website: input.website?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
    contactPhone: input.contactPhone?.trim() || null,
    industry: input.industry?.trim() || null,
    hqLocation: input.hqLocation?.trim() || null,
  });
  return toCompanyDto(doc);
}

export async function updateCompany(
  id: string,
  patch: UpdateCompanyInput,
): Promise<CompanyDto> {
  const objId = ensureObjectId(id, 'Company');
  const doc = await Company.findOne({ _id: objId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Company not found.');
  if (patch.name !== undefined) doc.name = patch.name.trim();
  if (patch.slug !== undefined) doc.slug = patch.slug.trim();
  if (patch.description !== undefined) doc.description = patch.description.trim();
  if (patch.website !== undefined) doc.website = patch.website?.trim() || null;
  if (patch.contactEmail !== undefined) doc.contactEmail = patch.contactEmail?.trim() || null;
  if (patch.contactPhone !== undefined) doc.contactPhone = patch.contactPhone?.trim() || null;
  if (patch.industry !== undefined) doc.industry = patch.industry?.trim() || null;
  if (patch.hqLocation !== undefined) doc.hqLocation = patch.hqLocation?.trim() || null;
  await doc.save();
  return toCompanyDto(doc);
}

export async function softDeleteCompany(id: string): Promise<void> {
  const objId = ensureObjectId(id, 'Company');
  const doc = await Company.findOne({ _id: objId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Company not found.');
  doc.deletedAt = new Date();
  await doc.save();
}

// --------- Job postings -----------------------------------------------

async function hydratePostingsCtx(
  docs: HydratedJobPosting[],
): Promise<JobPostingDtoCtx[]> {
  if (docs.length === 0) return [];
  const companyIds = [...new Set(docs.map((d) => String(d.companyId)))].map(
    (s) => new Types.ObjectId(s),
  );
  const postingIds = docs.map((d) => d._id);
  const [companies, applicantCounts] = await Promise.all([
    Company.find({ _id: { $in: companyIds } })
      .select({ name: 1 })
      .lean(),
    JobApplication.aggregate([
      { $match: { jobPostingId: { $in: postingIds } } },
      { $group: { _id: '$jobPostingId', n: { $sum: 1 } } },
    ]),
  ]);
  const cmap = new Map(companies.map((c) => [String(c._id), c.name as string]));
  const amap = new Map<string, number>(
    applicantCounts.map((a) => [String(a._id), a.n as number]),
  );
  return docs.map((d) => ({
    companyName: cmap.get(String(d.companyId)) ?? null,
    applicantCount: amap.get(String(d._id)) ?? 0,
  }));
}

export interface ListJobPostingsQuery {
  state?: JobPostingState;
  companyId?: string;
  // When true, the public student feed: only `published` postings.
  publicOnly?: boolean;
  // When set, restrict to postings whose `targetProgramIds` either is
  // empty OR includes this id. Used by the student feed to filter to
  // openings relevant to the caller's programme.
  forProgramId?: string;
}

export async function listJobPostings(
  query: ListJobPostingsQuery = {},
): Promise<JobPostingDto[]> {
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.publicOnly) {
    filter.state = 'published';
  } else if (query.state) {
    filter.state = query.state;
  }
  if (query.companyId && Types.ObjectId.isValid(query.companyId)) {
    filter.companyId = new Types.ObjectId(query.companyId);
  }
  if (query.forProgramId && Types.ObjectId.isValid(query.forProgramId)) {
    filter.$or = [
      { targetProgramIds: { $size: 0 } },
      { targetProgramIds: new Types.ObjectId(query.forProgramId) },
    ];
  }
  const docs = await JobPosting.find(filter).sort({ createdAt: -1 });
  const ctxs = await hydratePostingsCtx(docs);
  return docs.map((d, i) => toJobPostingDto(d, ctxs[i]));
}

export async function getJobPostingById(id: string): Promise<JobPostingDto> {
  const objId = ensureObjectId(id, 'Job posting');
  const doc = await JobPosting.findOne({ _id: objId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Job posting not found.');
  const [ctx] = await hydratePostingsCtx([doc]);
  return toJobPostingDto(doc, ctx);
}

export async function createJobPosting(
  input: CreateJobPostingInput,
  postedByUserId: Types.ObjectId,
): Promise<JobPostingDto> {
  const companyObjId = ensureObjectId(input.companyId, 'Company');
  const company = await Company.findOne({ _id: companyObjId, deletedAt: null });
  if (!company) throw new HttpError(404, 'NOT_FOUND', 'Company not found.');

  const targetProgramIds = (input.targetProgramIds ?? [])
    .filter((p) => Types.ObjectId.isValid(p))
    .map((p) => new Types.ObjectId(p));

  const doc = await JobPosting.create({
    companyId: companyObjId,
    title: input.title.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    employmentType: input.employmentType,
    minSalaryPaise: input.minSalaryPaise ?? null,
    maxSalaryPaise: input.maxSalaryPaise ?? null,
    eligibility: input.eligibility?.trim() ?? '',
    targetProgramIds,
    applicationDeadline: input.applicationDeadline
      ? new Date(input.applicationDeadline)
      : null,
    postedByUserId,
    state: 'draft',
  });
  const [ctx] = await hydratePostingsCtx([doc]);
  return toJobPostingDto(doc, ctx);
}

export async function updateJobPosting(
  id: string,
  patch: UpdateJobPostingInput,
): Promise<JobPostingDto> {
  const objId = ensureObjectId(id, 'Job posting');
  const doc = await JobPosting.findOne({ _id: objId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Job posting not found.');
  if (patch.title !== undefined) doc.title = patch.title.trim();
  if (patch.description !== undefined) doc.description = patch.description.trim();
  if (patch.location !== undefined) doc.location = patch.location.trim();
  if (patch.employmentType !== undefined) doc.employmentType = patch.employmentType;
  if (patch.minSalaryPaise !== undefined) doc.minSalaryPaise = patch.minSalaryPaise;
  if (patch.maxSalaryPaise !== undefined) doc.maxSalaryPaise = patch.maxSalaryPaise;
  if (patch.eligibility !== undefined) doc.eligibility = patch.eligibility.trim();
  if (patch.targetProgramIds !== undefined) {
    doc.targetProgramIds = patch.targetProgramIds
      .filter((p) => Types.ObjectId.isValid(p))
      .map((p) => new Types.ObjectId(p));
  }
  if (patch.applicationDeadline !== undefined) {
    doc.applicationDeadline = patch.applicationDeadline
      ? new Date(patch.applicationDeadline)
      : null;
  }
  const previousState = doc.state;
  if (patch.state !== undefined) doc.state = patch.state;
  await doc.save();

  // M10i — Notification when a posting flips from draft → published.
  // Fan out to students in the target programmes (or all students if
  // the posting is open to all). Best-effort: enqueue failure doesn't
  // unwind the save.
  if (previousState !== 'published' && doc.state === 'published') {
    try {
      const programFilter =
        doc.targetProgramIds.length > 0 ? { programId: { $in: doc.targetProgramIds } } : {};
      const students = await User.find({
        role: 'student',
        status: 'active',
        ...programFilter,
      })
        .select({ _id: 1 })
        .lean();
      if (students.length > 0) {
        const company = await Company.findById(doc.companyId).select({ name: 1 }).lean();
        await enqueueNotification({
          type: 'placement.job_posted',
          recipients: students.map((s: { _id: Types.ObjectId }) => s._id),
          title: `New job opening: ${doc.title}`,
          body: `${company?.name ?? 'A company'} is hiring for ${doc.title}${
            doc.location ? ` in ${doc.location}` : ''
          }. View details on the Jobs page.`,
          data: { jobPostingId: doc._id.toString() },
        });
      }
    } catch (err) {
      // Silent — placement should not 500 because the notification fan-out
      // hiccuped. The audit row + JobPosting state change still landed.
      console.warn('[placement] job_posted notification failed', err);
    }
  }

  const [ctx] = await hydratePostingsCtx([doc]);
  return toJobPostingDto(doc, ctx);
}

export async function softDeleteJobPosting(id: string): Promise<void> {
  const objId = ensureObjectId(id, 'Job posting');
  const doc = await JobPosting.findOne({ _id: objId, deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Job posting not found.');
  doc.deletedAt = new Date();
  await doc.save();
}

// --------- Job applications -------------------------------------------

export async function applyToJob(
  postingId: string,
  studentUserId: Types.ObjectId,
  input: ApplyToJobInput,
): Promise<JobApplicationDto> {
  const postingObjId = ensureObjectId(postingId, 'Job posting');
  const posting = await JobPosting.findOne({
    _id: postingObjId,
    deletedAt: null,
    state: 'published',
  });
  if (!posting) {
    throw new HttpError(
      404,
      'NOT_FOUND',
      'Job posting not found or not currently open.',
    );
  }
  if (
    posting.applicationDeadline &&
    posting.applicationDeadline.getTime() < Date.now()
  ) {
    throw new HttpError(409, 'DEADLINE_PASSED', 'Application deadline has passed.');
  }
  // Soft eligibility — empty targetProgramIds means open to all.
  if (posting.targetProgramIds.length > 0) {
    const user = await User.findById(studentUserId).select({ programId: 1 }).lean();
    const studentProgramId = user?.programId;
    const eligible = !!(
      studentProgramId &&
      posting.targetProgramIds.some((p) => p.equals(studentProgramId))
    );
    if (!eligible) {
      throw new HttpError(
        403,
        'PROGRAMME_INELIGIBLE',
        'This posting is restricted to other programmes.',
      );
    }
  }

  // Snapshot the resume URL — prefer the explicit input override, fall
  // back to the student's profile resume.
  const resumeOverride = input.resumeUrl?.trim();
  let resumeSnapshot: string | null = null;
  if (resumeOverride) {
    resumeSnapshot = resumeOverride;
  } else {
    const user = await User.findById(studentUserId).select({ resumeUrl: 1 }).lean();
    resumeSnapshot = (user?.resumeUrl as string | null) ?? null;
  }
  if (!resumeSnapshot) {
    throw new HttpError(
      422,
      'RESUME_REQUIRED',
      'Add a resume URL to your profile before applying.',
    );
  }

  // Upsert keyed by (posting, student).
  const existing = await JobApplication.findOne({
    jobPostingId: postingObjId,
    studentId: studentUserId,
  });
  if (existing) {
    if (existing.status === 'withdrawn') {
      // Re-applying after withdrawal: flip status, refresh snapshot.
      existing.status = 'applied';
      existing.resumeUrl = resumeSnapshot;
      existing.coverNote = input.coverNote?.trim() ?? '';
      existing.appliedAt = new Date();
      await existing.save();
      return toJobApplicationDto(existing);
    }
    return toJobApplicationDto(existing);
  }
  const doc = await JobApplication.create({
    jobPostingId: postingObjId,
    studentId: studentUserId,
    resumeUrl: resumeSnapshot,
    coverNote: input.coverNote?.trim() ?? '',
    status: 'applied',
  });
  return toJobApplicationDto(doc);
}

export async function listApplicationsForPosting(
  postingId: string,
): Promise<JobApplicationDto[]> {
  const objId = ensureObjectId(postingId, 'Job posting');
  const apps = await JobApplication.find({ jobPostingId: objId }).sort({
    appliedAt: -1,
  });
  if (apps.length === 0) return [];
  const studentIds = [...new Set(apps.map((a) => String(a.studentId)))].map(
    (s) => new Types.ObjectId(s),
  );
  const students = await User.find({ _id: { $in: studentIds } })
    .select({ name: 1, code: 1 })
    .lean();
  const smap = new Map(
    students.map((s) => [
      String(s._id),
      { name: s.name as string, code: (s.code as string | null) ?? null },
    ]),
  );
  return apps.map((a) =>
    toJobApplicationDto(a, {
      studentName: smap.get(String(a.studentId))?.name ?? null,
      studentCode: smap.get(String(a.studentId))?.code ?? null,
    }),
  );
}

export async function listApplicationsForStudent(
  studentUserId: Types.ObjectId,
): Promise<JobApplicationDto[]> {
  const apps = await JobApplication.find({ studentId: studentUserId }).sort({
    appliedAt: -1,
  });
  return apps.map((a) => toJobApplicationDto(a));
}

export async function updateApplicationStatus(
  applicationId: string,
  patch: UpdateJobApplicationInput,
): Promise<JobApplicationDto> {
  const objId = ensureObjectId(applicationId, 'Job application');
  const doc = await JobApplication.findById(objId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  if (!JOB_APPLICATION_STATUSES.includes(patch.status)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid status.');
  }
  doc.status = patch.status;
  if (patch.interviewNote !== undefined) {
    doc.interviewNote = patch.interviewNote?.trim() || null;
  }
  await doc.save();
  return toJobApplicationDto(doc);
}

export async function withdrawApplication(
  applicationId: string,
  studentUserId: Types.ObjectId,
): Promise<JobApplicationDto> {
  const objId = ensureObjectId(applicationId, 'Job application');
  const doc = await JobApplication.findById(objId);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  if (!doc.studentId.equals(studentUserId)) {
    throw new HttpError(403, 'FORBIDDEN', 'Cannot withdraw another student\'s application.');
  }
  doc.status = 'withdrawn';
  await doc.save();
  return toJobApplicationDto(doc);
}

// --------- Analytics --------------------------------------------------

export async function buildPlacementAnalytics(): Promise<PlacementAnalyticsDto> {
  const [
    totalCompanies,
    totalPostings,
    publishedPostings,
    statusAgg,
    topAgg,
    programAgg,
  ] = await Promise.all([
    Company.countDocuments({ deletedAt: null }),
    JobPosting.countDocuments({ deletedAt: null }),
    JobPosting.countDocuments({ deletedAt: null, state: 'published' }),
    JobApplication.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    JobApplication.aggregate([
      { $lookup: { from: 'jobpostings', localField: 'jobPostingId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $group: { _id: '$p.companyId', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $project: { companyId: '$_id', name: '$c.name', applicationCount: '$n' } },
    ]),
    JobApplication.aggregate([
      { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      {
        $group: {
          _id: '$u.programId',
          applicationsSubmitted: { $sum: 1 },
          selectedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'selected'] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const applicationsByStatus: Record<JobApplicationStatus, number> = {
    applied: 0,
    shortlisted: 0,
    interview_scheduled: 0,
    selected: 0,
    rejected: 0,
    withdrawn: 0,
  };
  for (const s of statusAgg) {
    applicationsByStatus[s._id as JobApplicationStatus] = s.n as number;
  }
  const totalApplications = Object.values(applicationsByStatus).reduce(
    (a, b) => a + b,
    0,
  );

  const topCompanies = topAgg.map(
    (t: { companyId: Types.ObjectId; name: string; applicationCount: number }) => ({
      companyId: String(t.companyId),
      name: t.name,
      applicationCount: t.applicationCount,
    }),
  );

  // Hydrate program names for the rollup.
  const programIds = programAgg
    .map((p: { _id: Types.ObjectId | null }) => p._id)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const programs = await Program.find({ _id: { $in: programIds } })
    .select({ name: 1 })
    .lean();
  const pmap = new Map(programs.map((p) => [String(p._id), p.name as string]));
  const byProgram = programAgg
    .filter(
      (p: { _id: Types.ObjectId | null }) => p._id !== null && p._id !== undefined,
    )
    .map(
      (p: {
        _id: Types.ObjectId;
        applicationsSubmitted: number;
        selectedCount: number;
      }) => ({
        programId: String(p._id),
        programName: pmap.get(String(p._id)) ?? '(unknown)',
        applicationsSubmitted: p.applicationsSubmitted,
        selectedCount: p.selectedCount,
      }),
    );

  return {
    generatedAt: new Date().toISOString(),
    totalCompanies,
    totalPostings,
    publishedPostings,
    totalApplications,
    applicationsByStatus,
    topCompanies,
    byProgram,
  };
}

// Used by the cross-batch reports module if it wants to surface
// placement signal — keeps the read-side simple.
export async function listPostingsForProgramme(
  programmeId: string,
): Promise<JobPostingDto[]> {
  if (!Types.ObjectId.isValid(programmeId)) return [];
  return listJobPostings({ publicOnly: true, forProgramId: programmeId });
}

// Convenience for the seed/test environments — count active enrolments
// in a programme so analytics doesn't divide by zero. Exposed for the
// route layer to attach as ?totalStudents.
export async function countActiveStudentsInProgramme(
  programmeId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(programmeId)) return 0;
  return Enrollment.countDocuments({
    programId: new Types.ObjectId(programmeId),
    status: 'active',
  });
}
