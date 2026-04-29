import type {
  BatchStatus,
  CourseState,
  EnrollmentAccessState,
  EnrollmentStatus,
  ModuleContentKind,
} from '../enums.js';
import type { OutstandingFeesDto } from './fees.js';
import type { TimetableOccurrenceDto } from './timetable.js';
import type { UserPublicDto } from './user.js';

export interface ProgramDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  totalHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateProgramInput {
  name: string;
  slug: string;
  description?: string;
  totalHours?: number;
  isActive?: boolean;
}

export interface UpdateProgramInput {
  name?: string;
  slug?: string;
  description?: string;
  totalHours?: number;
  isActive?: boolean;
}

/**
 * One row in the program-learning-outcome list a course inherits from
 * its program. Surfaced on the Overview tab so faculty can see what the
 * course is supposed to land at the program level.
 */
export interface ProgramLearningOutcomeDto {
  outcomeId: string;
  code: string;
  outcomeNumber: number | null;
  statement: string;
  bloomLevel: string;
  linkedKSCs: string[];
}

export interface CourseDto {
  id: string;
  programId: string;
  name: string;
  slug: string;
  summary: string;
  state: CourseState;
  publishedAt: string | null;
  publishedVersion: number;
  sequential: boolean;
  certificateTemplateId: string | null;
  facultyIds: string[];
  /**
   * Course-level program-learning-outcome roll-up. Populated by the
   * curriculum import; faculty can edit via PATCH /v1/courses/:id.
   */
  programLearningOutcomes: ProgramLearningOutcomeDto[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCourseInput {
  programId: string;
  name: string;
  slug: string;
  summary?: string;
  sequential?: boolean;
  certificateTemplateId?: string | null;
  facultyIds?: string[];
}

export interface UpdateCourseInput {
  name?: string;
  slug?: string;
  summary?: string;
  sequential?: boolean;
  certificateTemplateId?: string | null;
  facultyIds?: string[];
}

export interface ModuleContentDto {
  id: string;
  kind: ModuleContentKind;
  title: string;
  videoUrl: string | null;
  pdfUrl: string | null;
  pdfStorageKey: string | null;
  allowDownload: boolean;
  textMarkdown: string | null;
  quizId: string | null;
}

/**
 * One row in a module's learning-outcome list (the MLOs in the
 * curriculum-generator vocabulary). Carries Bloom level + competency
 * links so faculty can see what each module is supposed to land.
 */
export interface ModuleLearningOutcomeDto {
  mloId: string;
  code: string;
  statement: string;
  bloomLevel: string;
  verb: string;
  linkedPLOs: string[];
  linkedKSCs: string[];
}

export interface ModuleDto {
  id: string;
  courseId: string;
  title: string;
  order: number;
  content: ModuleContentDto[];
  /**
   * Curriculum-generator-derived metadata, exposed so the Content tab
   * can render a "module overview" panel with description, outcomes,
   * prerequisites, and faculty-private notes.
   */
  code: string | null;
  aim: string;
  prerequisites: string[];
  learningOutcomes: ModuleLearningOutcomeDto[];
  totalHours: number | null;
  contactHours: number | null;
  selfStudyHours: number | null;
  /**
   * Faculty-private notes — staff-only, never returned to students. Mirrors
   * `Session.notes`. Empty string when unset.
   */
  facultyNotes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateModuleInput {
  title: string;
  order: number;
  content?: ModuleContentInput[];
}

export interface ModuleContentInput {
  kind: ModuleContentKind;
  title: string;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  pdfStorageKey?: string | null;
  allowDownload?: boolean;
  textMarkdown?: string | null;
  quizId?: string | null;
}

export interface UpdateModuleInput {
  title?: string;
  order?: number;
  content?: ModuleContentInput[];
  /**
   * Faculty-editable curriculum metadata (PR #16 — "module overview"
   * panel). Each field is optional so partial PATCHes work.
   */
  aim?: string;
  prerequisites?: string[];
  facultyNotes?: string;
}

export interface BatchDto {
  id: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: BatchStatus;
  coordinators: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateBatchInput {
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity?: number;
  coordinators?: string[];
  status?: BatchStatus;
}

export interface UpdateBatchInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  status?: BatchStatus;
  coordinators?: string[];
}

export interface EnrollmentDto {
  id: string;
  studentId: string;
  batchId: string;
  courseId: string;
  programId: string;
  validFrom: string;
  validTo: string;
  status: EnrollmentStatus;
  accessState: EnrollmentAccessState;
  completed: boolean;
  completedAt: string | null;
  certificateUrl: string | null;
  certificateIssuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Hydrated mini-summary of the parent course. Populated by the
   * student-facing list/detail endpoints so the UI doesn't have to
   * stringify a truncated ObjectId in place of the title (PR #15 / FUT-2).
   * Optional / nullable: raw enrolment endpoints (e.g. admin lookups by
   * id) may omit this to keep their payload narrow.
   */
  course?: {
    id: string;
    name: string;
    slug: string;
    state: 'sandbox' | 'published';
  } | null;
}

export interface CreateEnrollmentInput {
  studentId: string;
  programId: string;
  batchId: string;
  validFrom: string;
  validTo: string;
}

export interface UpdateEnrollmentInput {
  batchId?: string;
  validTo?: string;
  completed?: boolean;
  status?: Extract<EnrollmentStatus, 'revoked'>;
  accessState?: EnrollmentAccessState;
}

export interface DashboardStubBucket<T> {
  stub: true;
  value: T;
}

export interface StudentDashboardDto {
  student: UserPublicDto;
  enrolments: EnrollmentDto[];
  nextClass: { stub: boolean; value: TimetableOccurrenceDto | null };
  outstandingFees: { stub: true; totalPaise: number } | OutstandingFeesDto;
  openTickets: { stub: true; count: number };
  newFeedback: { stub: true; count: number };
  // M8 — real buckets (no longer stubs after certificates + notifications land).
  certificates: { count: number; latestIssuedAt: string | null };
  unreadNotifications: { count: number };
}
