// Q-M4-05 — Notification template registry.
//
// Hardcoded title/body strings across feeReminder, payment, suspension,
// certificate, ticket, grading, feedback, assignment and placement
// services made copy edits a code-and-deploy task. Logan/Rejin asked for
// one place to grep + edit copy without touching service logic — this is
// it.
//
// Each template renders to `{title, body}` from a typed `vars` object.
// Callers pull the renderer by name and pass the variables they have;
// service code stays focused on side effects (DB writes, email dispatch),
// not string composition.
//
// i18n is intentionally out-of-scope for Phase 1 (Q-M4-05). English-only
// strings ship here; switch to a (locale, key) → renderer table when
// LUC asks for Hindi.

import { formatPaiseAsRupees } from './amountInWordsService.js';

export interface RenderedNotification {
  title: string;
  body: string;
}

export type TemplateRenderer<V extends Record<string, unknown> = Record<string, unknown>> = (
  vars: V,
) => RenderedNotification;

// -------- Timetable -------------------------------------------------

export interface TimetableChangeVars extends Record<string, unknown> {
  courseName: string;
  batchName: string;
  istDate: string;
  action: 'cancel' | 'reschedule' | 'add' | 'updated' | 'deleted';
  reason?: string | null;
}

const TIMETABLE_VERB: Record<TimetableChangeVars['action'], string> = {
  cancel: 'cancelled',
  reschedule: 'rescheduled',
  add: 'added',
  updated: 'updated',
  deleted: 'removed',
};

const renderTimetableChange: TemplateRenderer<TimetableChangeVars> = (v) => {
  const verb = TIMETABLE_VERB[v.action] ?? v.action;
  const bodyLines = [
    `Batch: ${v.batchName}`,
    `Course: ${v.courseName}`,
    `Date: ${v.istDate} (IST)`,
    `Change: ${verb}`,
  ];
  if (v.reason) bodyLines.push(`Reason: ${v.reason}`);
  return {
    title: `Timetable update: ${v.courseName} ${verb}`,
    body: bodyLines.join('\n'),
  };
};

// -------- Fees ------------------------------------------------------

export interface FeesPaidVars extends Record<string, unknown> {
  amountPaise: number;
  receiptCode: string;
}

const renderFeesPaid: TemplateRenderer<FeesPaidVars> = (v) => ({
  title: 'Payment received',
  body: `We have received your payment of ${formatPaiseAsRupees(v.amountPaise)}. Your receipt ${v.receiptCode} is ready to download.`,
});

export interface FeesSuspendedVars extends Record<string, unknown> {
  maxOverdueDays: number;
}

const renderFeesSuspended: TemplateRenderer<FeesSuspendedVars> = (v) => ({
  title: 'Access suspended — fee outstanding',
  body: `Your India Learns access has been suspended because a fee installment is ${v.maxOverdueDays} days overdue. Please contact Finance or raise a Finance ticket to restore access.`,
});

// -------- Certificate ----------------------------------------------

export interface CertificateIssuedVars extends Record<string, unknown> {
  courseName: string;
  certificateUrl: string;
}

const renderCertificateIssued: TemplateRenderer<CertificateIssuedVars> = (v) => ({
  title: `Congratulations! Your ${v.courseName} certificate is ready.`,
  body: `You've completed ${v.courseName}. Download your certificate: ${v.certificateUrl}`,
});

export interface StudentCourseCompletedVars extends Record<string, unknown> {
  studentLabel: string;
  courseName: string;
}

const renderStudentCourseCompleted: TemplateRenderer<StudentCourseCompletedVars> = (v) => ({
  title: `${v.studentLabel} completed ${v.courseName}`,
  body:
    `${v.studentLabel} just finished the ${v.courseName} course. ` +
    'A certificate is being issued; you can verify on the enrolment page.',
});

// -------- Tickets ---------------------------------------------------

export interface TicketCreatedVars extends Record<string, unknown> {
  category: string;
  code: string;
  subject: string;
  descriptionPreview: string;
}

const renderTicketCreated: TemplateRenderer<TicketCreatedVars> = (v) => ({
  title: `New ${v.category} ticket: ${v.code}`,
  body: `${v.subject}\n\n${v.descriptionPreview}`,
});

export interface TicketStateChangedVars extends Record<string, unknown> {
  code: string;
  state: string;
  note?: string | null;
}

const renderTicketStateChanged: TemplateRenderer<TicketStateChangedVars> = (v) => ({
  title: `Ticket ${v.code} is now ${v.state}`,
  body: v.note && v.note.trim().length > 0 ? v.note : `Status changed to ${v.state}.`,
});

export interface TicketAssignmentUpdatedVars extends Record<string, unknown> {
  code: string;
  subject: string;
}

const renderTicketAssignmentUpdated: TemplateRenderer<TicketAssignmentUpdatedVars> = (v) => ({
  title: `Ticket ${v.code} — assignment updated`,
  body: v.subject,
});

export interface TicketCommentedVars extends Record<string, unknown> {
  code: string;
  bodyPreview: string;
}

const renderTicketCommented: TemplateRenderer<TicketCommentedVars> = (v) => ({
  title: `Ticket ${v.code} has a new reply`,
  body: v.bodyPreview,
});

export interface TicketReopenRequestVars extends Record<string, unknown> {
  childCode: string;
  parentCode: string;
  reason: string;
}

const renderTicketReopenRequest: TemplateRenderer<TicketReopenRequestVars> = (v) => ({
  title: `Reopen request: ${v.childCode}`,
  body: `Parent: ${v.parentCode}\nReason: ${v.reason}`,
});

// -------- Assessments + feedback -----------------------------------

export interface AssessmentGradedExamVars extends Record<string, unknown> {
  examTitle: string;
  scorePercent: number;
  passed: boolean;
}

const renderAssessmentGradedExam: TemplateRenderer<AssessmentGradedExamVars> = (v) => ({
  title: `Exam graded: ${v.examTitle}`,
  body: `Your score: ${v.scorePercent.toFixed(1)}% — ${v.passed ? 'Passed' : 'Not passed'}`,
});

export interface AssignmentGradedVars extends Record<string, unknown> {
  assignmentTitle: string;
  scoreText: string;
}

const renderAssignmentGraded: TemplateRenderer<AssignmentGradedVars> = (v) => ({
  title: `${v.assignmentTitle} graded`,
  body: v.scoreText,
});

export interface FeedbackPublishedVars extends Record<string, unknown> {
  summary: string;
}

const renderFeedbackPublished: TemplateRenderer<FeedbackPublishedVars> = (v) => ({
  title: 'New feedback from your faculty',
  body: v.summary.slice(0, 500),
});

// -------- Placement ------------------------------------------------

export interface JobPostedVars extends Record<string, unknown> {
  jobTitle: string;
  companyName: string;
  programNameHint?: string | null;
}

const renderJobPosted: TemplateRenderer<JobPostedVars> = (v) => ({
  title: `New job opening: ${v.jobTitle}`,
  body: `${v.companyName} is hiring for ${v.jobTitle}${
    v.programNameHint ? ` (${v.programNameHint})` : ''
  }. Open the Jobs tab to view the brief and apply.`,
});

// -------- Registry --------------------------------------------------

export const NOTIFICATION_TEMPLATES = {
  'timetable.change': renderTimetableChange,
  'fees.paid': renderFeesPaid,
  'fees.suspended': renderFeesSuspended,
  'certificate.issued': renderCertificateIssued,
  'student.course_completed': renderStudentCourseCompleted,
  'ticket.created': renderTicketCreated,
  'ticket.state_changed': renderTicketStateChanged,
  'ticket.assignment_updated': renderTicketAssignmentUpdated,
  'ticket.commented': renderTicketCommented,
  'ticket.reopen_request': renderTicketReopenRequest,
  'assessment.graded.exam': renderAssessmentGradedExam,
  'assignment.graded': renderAssignmentGraded,
  'feedback.published': renderFeedbackPublished,
  'job.posted': renderJobPosted,
} as const;

export type NotificationTemplateKey = keyof typeof NOTIFICATION_TEMPLATES;

export function renderTemplate<K extends NotificationTemplateKey>(
  key: K,
  vars: Parameters<(typeof NOTIFICATION_TEMPLATES)[K]>[0],
): RenderedNotification {
  // Cast through unknown — the keyed conditional types defeat TS's
  // narrowing here, but at runtime each renderer accepts its own vars.
  const render = NOTIFICATION_TEMPLATES[key] as TemplateRenderer<Record<string, unknown>>;
  return render(vars as Record<string, unknown>);
}
