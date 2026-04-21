import type {
  FeedbackLevel,
  FeedbackStatus,
  RubricCriterionKind,
} from '../enums.js';

export interface RubricCriterionDto {
  label: string;
  kind: RubricCriterionKind;
  maxScore: number | null;
  scale: string[];
}

export interface RubricDto {
  id: string;
  courseId: string;
  name: string;
  criteria: RubricCriterionDto[];
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRubricInput {
  courseId: string;
  name: string;
  criteria: RubricCriterionDto[];
  isTemplate?: boolean;
}

export interface UpdateRubricInput {
  name?: string;
  criteria?: RubricCriterionDto[];
  isTemplate?: boolean;
}

export interface FeedbackScoreDto {
  criterionIndex: number;
  score: number | null;
  label: string | null;
}

export interface FeedbackEntryDto {
  id: string;
  studentId: string;
  courseId: string;
  moduleId: string | null;
  facultyId: string;
  level: FeedbackLevel;
  assessmentRef: string | null;
  rubricId: string | null;
  scores: FeedbackScoreDto[];
  comments: string;
  summary: string;
  status: FeedbackStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackInput {
  studentId: string;
  courseId: string;
  moduleId?: string | null;
  level: FeedbackLevel;
  assessmentRef?: string | null;
  rubricId?: string | null;
  scores?: FeedbackScoreDto[];
  comments?: string;
  summary: string;
  status?: FeedbackStatus;
}

export interface UpdateFeedbackInput {
  moduleId?: string | null;
  level?: FeedbackLevel;
  assessmentRef?: string | null;
  rubricId?: string | null;
  scores?: FeedbackScoreDto[];
  comments?: string;
  summary?: string;
  status?: FeedbackStatus;
}

export interface FeedbackListQuery {
  studentId?: string;
  courseId?: string;
  moduleId?: string;
  facultyId?: string;
  level?: FeedbackLevel;
  status?: FeedbackStatus;
  limit?: number;
}

export interface FacultyDigestJobResult {
  processed: number;
  facultyCount: number;
  totalPendingItems: number;
  emailsSent: number;
  emailErrors: number;
}
