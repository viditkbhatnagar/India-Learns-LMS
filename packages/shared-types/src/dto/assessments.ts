import type {
  ExamQuestionKind,
  QuizQuestionKind,
  QuizState,
} from '../enums.js';

export interface QuizQuestionDto {
  text: string;
  kind: QuizQuestionKind;
  options: string[];
  correctIndices: number[];
  points: number;
}

export interface QuizDto {
  id: string;
  moduleId: string;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: QuizQuestionDto[];
  state: QuizState;
  openAt: string | null;
  closeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentQuizQuestionDto {
  text: string;
  kind: QuizQuestionKind;
  options: string[];
  points: number;
}

export interface StudentQuizDto {
  id: string;
  moduleId: string;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: StudentQuizQuestionDto[];
  state: QuizState;
  openAt: string | null;
  closeAt: string | null;
}

export interface CreateQuizInput {
  moduleId: string;
  title: string;
  durationMinutes?: number | null;
  maxAttempts?: number;
  passingPercent?: number;
  questions: QuizQuestionDto[];
  openAt?: string | null;
  closeAt?: string | null;
}

export interface UpdateQuizInput {
  title?: string;
  durationMinutes?: number | null;
  maxAttempts?: number;
  passingPercent?: number;
  questions?: QuizQuestionDto[];
  state?: QuizState;
  openAt?: string | null;
  closeAt?: string | null;
}

export interface QuizAnswerInput {
  questionIndex: number;
  chosenIndices: number[];
}

export interface SubmitQuizAttemptInput {
  answers: QuizAnswerInput[];
}

export interface QuizAttemptAnswerDto {
  questionIndex: number;
  chosenIndices: number[];
}

export interface QuizAttemptDto {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: QuizAttemptAnswerDto[];
  scorePercent: number | null;
  passed: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestionDto {
  text: string;
  kind: ExamQuestionKind;
  options: string[];
  correctIndices: number[];
  points: number;
  rubricId: string | null;
  wordLimit: number | null;
}

export interface ExamDto {
  id: string;
  courseId: string;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: ExamQuestionDto[];
  state: QuizState;
  openAt: string | null;
  closeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentExamQuestionDto {
  text: string;
  kind: ExamQuestionKind;
  options: string[];
  points: number;
  wordLimit: number | null;
}

export interface StudentExamDto {
  id: string;
  courseId: string;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  passingPercent: number;
  questions: StudentExamQuestionDto[];
  state: QuizState;
  openAt: string | null;
  closeAt: string | null;
}

export interface CreateExamInput {
  courseId: string;
  title: string;
  durationMinutes?: number | null;
  maxAttempts?: number;
  passingPercent?: number;
  questions: ExamQuestionDto[];
  openAt?: string | null;
  closeAt?: string | null;
}

export interface UpdateExamInput {
  title?: string;
  durationMinutes?: number | null;
  maxAttempts?: number;
  passingPercent?: number;
  questions?: ExamQuestionDto[];
  state?: QuizState;
  openAt?: string | null;
  closeAt?: string | null;
}

export interface ExamEssayAnswerInput {
  questionIndex: number;
  text: string;
}

export interface SubmitExamAttemptInput {
  answers: QuizAnswerInput[];
  essayAnswers: ExamEssayAnswerInput[];
}

export interface ExamAttemptGradeRubricScore {
  criterionIndex: number;
  score: number | null;
  label: string | null;
}

export interface ExamAttemptGradeInput {
  questionIndex: number;
  score: number;
  comment: string;
  rubricScores?: ExamAttemptGradeRubricScore[];
}

export interface GradeExamAttemptInput {
  grades: ExamAttemptGradeInput[];
}

export interface ExamAttemptGradeDto {
  questionIndex: number;
  score: number;
  comment: string;
  rubricScores: ExamAttemptGradeRubricScore[];
}

export interface ExamAttemptDto {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: QuizAttemptAnswerDto[];
  essayAnswers: ExamEssayAnswerInput[];
  mcqScorePercent: number | null;
  essayScorePercent: number | null;
  totalScorePercent: number | null;
  passed: boolean | null;
  grades: ExamAttemptGradeDto[];
  graderUserId: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExamGradingQueueQuery {
  courseId?: string;
  limit?: number;
}
