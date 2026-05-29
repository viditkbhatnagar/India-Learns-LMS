import type {
  AdmissionMode,
  BatchStatus,
  CourseState,
  EnrollmentAccessState,
  EnrollmentStatus,
  ModuleContentKind,
  ProgramRequiredDocType,
} from '../enums.js';
import type { OutstandingFeesDto } from './fees.js';
import type { TimetableOccurrenceDto } from './timetable.js';
import type { UserPublicDto } from './user.js';

// Admissions M5+ — per-program required document slot config. Mirrors the
// model shape in api/src/models/program.ts.
// M10 — documentType uses ProgramRequiredDocType so SSLC / Plus Two /
// Degree / Transfer Certificate / Passport Photo are accepted.
export interface ProgramAdmissionsDocReqDto {
  documentType: ProgramRequiredDocType;
  label: string;
  required: boolean;
}

export interface ProgramDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  totalHours: number;
  isActive: boolean;
  // Admissions M5+ — exposed on the admin Program detail screen so admins
  // can toggle the funnel for a given program without going through Mongo.
  admissionsEnabled: boolean;
  admissionMode: AdmissionMode;
  applicationFeePaise: number;
  requiredDocs: ProgramAdmissionsDocReqDto[];
  requiresStatement: boolean;
  requiresReferences: boolean;
  referencesMinCount: number;
  referencesMaxCount: number;
  statementWordLimit: number;
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
  admissionsEnabled?: boolean;
  admissionMode?: AdmissionMode;
  applicationFeePaise?: number;
  requiredDocs?: ProgramAdmissionsDocReqDto[];
  requiresStatement?: boolean;
  requiresReferences?: boolean;
  referencesMinCount?: number;
  referencesMaxCount?: number;
  statementWordLimit?: number;
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

/** One glossary term + definition, shown to students on the course
 *  Glossary tab. Faculty-managed, course-level. */
export interface GlossaryEntryDto {
  term: string;
  definition: string;
}

/** One entry in the course Reading list. `url` makes the title a link;
 *  author / note are optional. Faculty-managed, course-level. */
export interface ReadingItemDto {
  title: string;
  author: string;
  url: string;
  note: string;
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
  /** Faculty-managed glossary (Logan request) — student-visible. */
  glossary: GlossaryEntryDto[];
  /** Faculty-managed reading list (Logan request) — student-visible. */
  readingList: ReadingItemDto[];
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
  /** Faculty-editable course content (Logan request). Replace-whole-list. */
  glossary?: GlossaryEntryDto[];
  readingList?: ReadingItemDto[];
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
  /**
   * Student-facing module syllabus. Long-form text shown in the module
   * overview panel — both faculty (edit) and students (read-only) see it.
   * Empty string when unset.
   */
  syllabus: string;
  /**
   * Optional uploaded syllabus document (PDF/DOCX/etc.). Bytes live in
   * S3 via the FileMeta indirection; `fileId` is the FileMeta._id and
   * also the `:id` for `${API_ORIGIN}/v1/files/:id`. Filename, size, and
   * contentType are denormalised so the student view can render the
   * download link without an extra lookup.
   */
  syllabusFile: ModuleSyllabusFileDto | null;
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

export interface ModuleSyllabusFileDto {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

/** PATCH-side input — pass the FileMeta id returned from the upload
 * endpoint, or `null` to remove. Server fills in filename/contentType/size
 * from FileMeta. */
export interface ModuleSyllabusFileInput {
  fileId: string;
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
  syllabus?: string;
  /** Attach (object), replace (object with different fileId), or remove (null). */
  syllabusFile?: ModuleSyllabusFileInput | null;
}

export interface BatchDto {
  id: string;
  programId: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  // Admissions M5+ — live seat count + the gate that decides whether this
  // batch appears in the public /apply cohort feed.
  seatsRemaining: number;
  openForApplications: boolean;
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
  // Admissions M5+ — admin can manually adjust both. Auto-decrement at admit
  // time (M7) will mutate seatsRemaining via $inc, not via this endpoint.
  seatsRemaining?: number;
  openForApplications?: boolean;
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
  // M10x — Excel "Total Fees Specified" upfront declaration. Null
  // means "not declared, use computed sum". Admin can set this on
  // /finance/students/:id and the page warns if installment totals
  // drift from it.
  declaredTotalPaise: number | null;
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

// =====================================================================
// PR #16 Phase 4 — student course-view aggregated DTO. The student
// "your course" page makes one call and gets back a fully-nested
// Module → Session → Assignment tree with status + progress rollups
// pre-computed server-side. Replaces the old flat enrolment list +
// session list + assignment list payload.
// =====================================================================

export type AssignmentStatus =
  | 'graded'
  | 'submitted'
  | 'late'
  | 'dueSoon'
  | 'upcoming';

export interface StudentAssignmentDto {
  id: string;
  title: string;
  dueAt: string;
  maxPoints: number;
  /** Null until the faculty publishes a grade. */
  score: number | null;
  /** Optional feedback string surfaced once the grade is published. */
  feedback: string | null;
  status: AssignmentStatus;
  /** Negative when overdue. Computed server-side at request time. */
  daysUntilDue: number;
}

export type StudentSessionState = 'not_started' | 'in_progress' | 'complete';

export interface StudentSessionDto {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  state: StudentSessionState;
  /** Mirrors the staff-side status — students see the same lifecycle. */
  status: 'upcoming' | 'in_progress' | 'completed';
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  assignments: StudentAssignmentDto[];
  progress: {
    total: number;
    completed: number;
    late: number;
    dueSoon: number;
  };
}

export interface StudentModuleDto {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  /** Module-level description — surfaced from `Module.aim`. */
  aim: string;
  /** Student-facing long-form syllabus (UAT round 5 / Logan). Empty
   *  string when faculty hasn't filled it in yet. */
  syllabus: string;
  /** Optional uploaded syllabus document — students download via the
   *  /v1/files/:fileId proxy. */
  syllabusFile: ModuleSyllabusFileDto | null;
  state: StudentSessionState;
  sessions: StudentSessionDto[];
  progress: {
    total: number;
    completed: number;
  };
}

export interface StudentCourseViewDto {
  course: {
    id: string;
    title: string;
    slug: string;
    state: CourseState;
    description: string;
  };
  enrolment: {
    id: string;
    validFrom: string;
    validTo: string;
    status: EnrollmentStatus;
    accessState: EnrollmentAccessState;
    completed: boolean;
  };
  progress: {
    totalAssignments: number;
    completedAssignments: number;
    /** 0–100, integer. */
    percentComplete: number;
    /** Order of the module the student is "currently in" (first
        in-progress, falling back to first not-started, falling back to
        the first module). */
    currentModuleOrder: number;
    currentModuleTitle: string;
  };
  counts: {
    late: number;
    dueSoon: number;
    upcoming: number;
  };
  /**
   * Pre-sorted action list (late first, then nearest due, top 5). The
   * page renders this in a "Needs your attention" panel — saves the
   * student from scrolling to find the overdue rows.
   */
  needsAttention: StudentAssignmentDto[];
  modules: StudentModuleDto[];
  /** Faculty-managed course glossary (Logan request) — read-only here. */
  glossary: GlossaryEntryDto[];
  /** Faculty-managed course reading list (Logan request) — read-only here. */
  readingList: ReadingItemDto[];
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
  // M10x — Excel "Total Fees Specified" upfront declaration. Pass null
  // to clear; otherwise an integer in paise.
  declaredTotalPaise?: number | null;
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
