// M10 — Reports module (LMS_Faculty_Features_Requirements_.docx §4).
//
// Three reports, each downloadable as JSON, XLSX (and PDF in a follow-up).
// All three are batch-scoped; admins can pull any batch, faculty only the
// batches they teach (route layer enforces).

// ---------- Attendance report ----------------------------------------

export interface AttendanceReportFilters {
  batchId: string;
  // Inclusive ISO date strings (YYYY-MM-DD). Both required.
  from: string;
  to: string;
  // Optional course filter — limits sessions counted to this course only.
  courseId?: string | null;
}

export interface AttendanceReportRow {
  studentId: string;
  studentCode: string | null;
  studentName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalMarked: number;
  // Attendance rate over `totalMarked` (excludes unmarked sessions). Range
  // 0-100, rounded to one decimal.
  attendanceRate: number;
}

export interface AttendanceReportDto {
  filters: AttendanceReportFilters;
  // Resolved at query time so the UI can render `Batch <code>` headings
  // without a second lookup.
  batchCode: string;
  programName: string;
  generatedAt: string; // ISO timestamp
  sessionCount: number;
  rows: AttendanceReportRow[];
}

// ---------- Batch summary report --------------------------------------

export interface BatchSummaryReportFilters {
  batchId: string;
}

export interface BatchSummaryReportDto {
  filters: BatchSummaryReportFilters;
  batchCode: string;
  programName: string;
  generatedAt: string;
  // Roll-ups across the batch.
  enrolledStudentCount: number;
  activeStudentCount: number;
  // Mean attendance rate over the lifetime of the batch. Same scoring as
  // AttendanceReportRow.attendanceRate.
  averageAttendanceRate: number;
  totalSessions: number;
  // Assignments
  totalAssignments: number;
  publishedSubmissionCount: number;
  draftSubmissionCount: number;
  needsGradingCount: number;
  // Fees (paise — integer)
  totalBilledPaise: number;
  totalCollectedPaise: number;
  totalOutstandingPaise: number;
}

// ---------- Assignment submissions report -----------------------------

export interface AssignmentSubmissionsReportFilters {
  batchId: string;
  // Inclusive ISO date strings. Filter applies to assignment.dueAt.
  from: string;
  to: string;
  courseId?: string | null;
}

export type AssignmentSubmissionReportStatus =
  | 'not_started'
  | 'submitted'
  | 'needs_grading'
  | 'graded_draft'
  | 'published';

export interface AssignmentSubmissionsReportCell {
  assignmentId: string;
  studentId: string;
  status: AssignmentSubmissionReportStatus;
  // null if status === 'not_started' or 'submitted' / 'needs_grading'.
  score: number | null;
  submittedAt: string | null;
  lateFlag: boolean;
}

export interface AssignmentSubmissionsReportAssignment {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  dueAt: string;
  maxScore: number;
}

export interface AssignmentSubmissionsReportStudent {
  id: string;
  code: string | null;
  name: string;
}

export interface AssignmentSubmissionsReportDto {
  filters: AssignmentSubmissionsReportFilters;
  batchCode: string;
  programName: string;
  generatedAt: string;
  assignments: AssignmentSubmissionsReportAssignment[];
  students: AssignmentSubmissionsReportStudent[];
  // Flat list — UI pivots into the matrix it wants.
  cells: AssignmentSubmissionsReportCell[];
}

// ---------- Format negotiation ----------------------------------------

export const REPORT_FORMATS = ['json', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
