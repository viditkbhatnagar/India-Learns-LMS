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
  // M10u — Optional "sessions held" window. When set, the report counts
  // only sessions whose actual held-date (completedAt for finished
  // sessions, else scheduledStart) falls in this window. Useful when
  // admin wants "attendance for the sessions actually held in May",
  // not just "every enrolled session in May".
  sessionsHeldFrom?: string | null;
  sessionsHeldTo?: string | null;
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

// ---------- Staff attendance report (Q-M10-followup-faculty-staff) -----
//
// Aggregates `StaffAttendance` rows over a date window. Admin sees every
// staff row; faculty only see their own (route layer enforces).

export type StaffAttendanceReportRole = 'faculty' | 'admin' | 'superadmin' | 'admissions_officer';

export interface StaffAttendanceReportFilters {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
  // Restrict to a single role bucket (e.g. only "faculty"). Optional —
  // omit to include every staff role with at least one mark in the range.
  role?: StaffAttendanceReportRole | null;
  // Restrict to a single user. Optional. Faculty role auto-scopes to self.
  userId?: string | null;
}

export interface StaffAttendanceReportRow {
  userId: string;
  userCode: string | null;
  userName: string;
  role: StaffAttendanceReportRole;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  halfDayCount: number;
  totalMarked: number;
  // Attendance rate over `totalMarked` (excludes unmarked days). Range
  // 0-100, rounded to one decimal. Present + late + half_day (×0.5) count
  // as attended; absent + leave do not.
  attendanceRate: number;
}

export interface StaffAttendanceReportDto {
  filters: StaffAttendanceReportFilters;
  generatedAt: string;
  // Distinct dates in [from, to] that had at least one mark; useful for
  // "working-days denominator" context in the preview header.
  workingDayCount: number;
  rows: StaffAttendanceReportRow[];
}

// ---------- Format negotiation ----------------------------------------

export const REPORT_FORMATS = ['json', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];
