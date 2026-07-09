// Entrance Exam module — DTOs shared across api + web.
//
// This is a fully isolated, temporary-candidate assessment surface. Candidates
// are NOT `User`s: they log in with phone + password against a separate
// collection, get a token scoped only to `/v1/entrance/*`, take a one-shot
// MCQ (+ one written) paper inside an admin-set window, and every answer is
// autosaved so a dropped connection or closed tab never loses data. Scores are
// admin-only; candidates never see them.

export type EntranceQuestionKind = 'mcq' | 'text';
export type EntranceExamState = 'draft' | 'live' | 'closed';
export type EntranceAttemptStatus = 'in_progress' | 'submitted' | 'graded';
export type EntranceCandidateStatus = 'not_started' | EntranceAttemptStatus;

/** Candidate-facing question — answer key stripped. */
export interface EntranceQuestionDto {
  index: number;
  section: string;
  text: string;
  kind: EntranceQuestionKind;
  options: string[];
  points: number;
}

/** Admin-facing question — includes the answer key. */
export interface EntranceQuestionAdminDto extends EntranceQuestionDto {
  correctIndex: number | null;
}

/** Candidate-facing exam — no answer key. */
export interface EntranceExamPublicDto {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  maxAttempts: number;
  state: EntranceExamState;
  opensAt: string | null;
  closesAt: string | null;
  questions: EntranceQuestionDto[];
}

export interface EntranceExamAdminDto {
  id: string;
  title: string;
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  maxAttempts: number;
  state: EntranceExamState;
  opensAt: string | null;
  closesAt: string | null;
  questions: EntranceQuestionAdminDto[];
  createdAt: string;
  updatedAt: string;
}

export interface EntranceCandidatePublicDto {
  id: string;
  name: string;
  phone: string;
}

export interface EntranceAttemptAnswerDto {
  questionIndex: number;
  selectedIndex: number | null;
  textAnswer: string;
  answeredAt: string | null;
}

/** What a candidate sees about their own in-flight attempt. Never any score. */
export interface EntranceAttemptSelfDto {
  id: string;
  attemptNumber: number;
  status: EntranceAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string;
  answers: EntranceAttemptAnswerDto[];
}

export interface EntranceLoginInput {
  phone: string;
  password: string;
}

export interface EntranceLoginResponse {
  candidate: EntranceCandidatePublicDto;
  exam: EntranceExamPublicDto;
  token: string;
  tokenExpiresIn: number;
  /** Current in-progress attempt to resume, if any. */
  attempt: EntranceAttemptSelfDto | null;
  /** Submitted (or graded) attempts already used. */
  attemptsUsed: number;
  maxAttempts: number;
}

/** Candidate page state: exam + current attempt + attempt allowance. */
export interface EntranceCandidateStateDto {
  exam: EntranceExamPublicDto;
  attempt: EntranceAttemptSelfDto | null;
  attemptsUsed: number;
  maxAttempts: number;
}

export interface SaveEntranceAnswerInput {
  questionIndex: number;
  selectedIndex?: number | null;
  textAnswer?: string;
}

export interface SaveEntranceAnswersInput {
  answers: SaveEntranceAnswerInput[];
}

// ---- Admin views ----------------------------------------------------------

export interface EntranceCandidateRowDto {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  status: EntranceCandidateStatus;
  attemptsUsed: number;
  maxAttempts: number;
  startedAt: string | null;
  submittedAt: string | null;
  // Scores reflect the candidate's BEST attempt so far.
  autoScoreMarks: number | null;
  manualScoreMarks: number | null;
  totalScoreMarks: number | null;
  totalMarks: number;
  pendingManualGrade: boolean;
}

export interface EntranceAttemptAnswerAdminDto {
  questionIndex: number;
  section: string;
  questionText: string;
  kind: EntranceQuestionKind;
  options: string[];
  selectedIndex: number | null;
  selectedOptionText: string | null;
  correctIndex: number | null;
  correctOptionText: string | null;
  isCorrect: boolean | null;
  textAnswer: string;
  awardedMarks: number | null;
  points: number;
  answeredAt: string | null;
}

export interface EntranceAttemptAdminDto {
  id: string;
  attemptNumber: number;
  candidate: EntranceCandidatePublicDto;
  examId: string;
  status: EntranceAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  autoScoreMarks: number;
  manualScoreMarks: number | null;
  manualComment: string;
  totalScoreMarks: number | null;
  totalMarks: number;
  ip: string;
  userAgent: string;
  gradedByUserId: string | null;
  gradedAt: string | null;
  answers: EntranceAttemptAnswerAdminDto[];
}

export interface EntranceCandidateDetailDto {
  candidate: EntranceCandidatePublicDto;
  maxAttempts: number;
  /** All attempts, newest first. */
  attempts: EntranceAttemptAdminDto[];
}

export interface GradeEntranceTextInput {
  questionIndex: number;
  marks: number;
  comment?: string;
}

export interface UpdateEntranceExamInput {
  state?: EntranceExamState;
  opensAt?: string | null;
  closesAt?: string | null;
  durationMinutes?: number;
  maxAttempts?: number;
}
