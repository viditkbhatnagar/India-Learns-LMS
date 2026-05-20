// M10 — Placement / Jobs module DTOs (LMS_Requirements §3).
//
// Three resources: Company, JobPosting, JobApplication. Resume is one URL
// field on User (`resumeUrl`) for V1 — versioned resumes is a future
// concern. Salary is in paise (integer) to mirror fees-money convention.

import type {
  JobApplicationStatus,
  JobEmploymentType,
  JobPostingState,
} from '../enums.js';

export interface CompanyDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  industry: string | null;
  hqLocation: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCompanyInput {
  name: string;
  slug: string;
  description?: string;
  website?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  industry?: string | null;
  hqLocation?: string | null;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>;

export interface JobPostingDto {
  id: string;
  companyId: string;
  // Hydrated when the GET endpoint includes the company; null when caller
  // didn't ask for it.
  companyName: string | null;
  title: string;
  description: string;
  location: string;
  employmentType: JobEmploymentType;
  // Both nullable — placements often hide compensation until offer.
  minSalaryPaise: number | null;
  maxSalaryPaise: number | null;
  eligibility: string;
  // Empty array means "open to all programmes".
  targetProgramIds: string[];
  applicationDeadline: string | null;
  postedByUserId: string;
  state: JobPostingState;
  // Counts attached server-side for admin views.
  applicantCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateJobPostingInput {
  companyId: string;
  title: string;
  description: string;
  location: string;
  employmentType: JobEmploymentType;
  minSalaryPaise?: number | null;
  maxSalaryPaise?: number | null;
  eligibility?: string;
  targetProgramIds?: string[];
  applicationDeadline?: string | null;
}

export interface UpdateJobPostingInput {
  title?: string;
  description?: string;
  location?: string;
  employmentType?: JobEmploymentType;
  minSalaryPaise?: number | null;
  maxSalaryPaise?: number | null;
  eligibility?: string;
  targetProgramIds?: string[];
  applicationDeadline?: string | null;
  state?: JobPostingState;
}

export interface JobApplicationDto {
  id: string;
  jobPostingId: string;
  studentId: string;
  // Hydrated when admin pulls applications for a posting; null on the
  // student's own view (they already know who they are).
  studentName: string | null;
  studentCode: string | null;
  // Snapshot of resume URL at apply time so changing User.resumeUrl
  // later doesn't retroactively rewrite past applications.
  resumeUrl: string | null;
  coverNote: string;
  status: JobApplicationStatus;
  // Optional free-text scheduling note attached by the placement team
  // when status === 'interview_scheduled'.
  interviewNote: string | null;
  appliedAt: string;
  updatedAt: string;
}

export interface ApplyToJobInput {
  // Optional — if omitted, the server uses User.resumeUrl. If neither
  // is set, the apply call 422s with RESUME_REQUIRED so the student is
  // routed to update their profile first.
  resumeUrl?: string | null;
  coverNote?: string;
}

export interface UpdateJobApplicationInput {
  status: JobApplicationStatus;
  interviewNote?: string | null;
}

// M10 — Placement analytics dashboard (LMS_Requirements §3).
export interface PlacementAnalyticsDto {
  generatedAt: string;
  totalCompanies: number;
  totalPostings: number;
  publishedPostings: number;
  totalApplications: number;
  // Status breakdown — keys are JobApplicationStatus values.
  applicationsByStatus: Record<JobApplicationStatus, number>;
  // Top-N companies by application count.
  topCompanies: Array<{ companyId: string; name: string; applicationCount: number }>;
  // Programme-level rollup.
  byProgram: Array<{
    programId: string;
    programName: string;
    applicationsSubmitted: number;
    selectedCount: number;
  }>;
}
