import type {
  BatchStatus,
  CourseState,
  EnrollmentAccessState,
  EnrollmentStatus,
  ModuleContentKind,
} from '../enums.js';
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

export interface ModuleDto {
  id: string;
  courseId: string;
  title: string;
  order: number;
  content: ModuleContentDto[];
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
  nextClass: { stub: true; value: null };
  outstandingFees: { stub: true; totalPaise: number };
  openTickets: { stub: true; count: number };
  newFeedback: { stub: true; count: number };
}
