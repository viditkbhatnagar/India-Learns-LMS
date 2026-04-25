export const ROLES = ['admin', 'superadmin', 'finance', 'faculty', 'student'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['pending', 'active', 'suspended', 'revoked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SUSPENSION_KINDS = ['manual', 'fees'] as const;
export type SuspensionKind = (typeof SUSPENSION_KINDS)[number];

export const DEPT_TAGS = [
  'operations',
  'it',
  'academics',
  'finance',
  'senior_mgmt',
] as const;
export type DeptTag = (typeof DEPT_TAGS)[number];

export const INVITE_TOKEN_KINDS = ['invite', 'reset'] as const;
export type InviteTokenKind = (typeof INVITE_TOKEN_KINDS)[number];

export const COURSE_STATES = ['sandbox', 'published'] as const;
export type CourseState = (typeof COURSE_STATES)[number];

export const BATCH_STATUSES = ['planned', 'active', 'completed', 'archived'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['active', 'expired', 'revoked'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_ACCESS_STATES = [
  'active',
  'warn1',
  'warn2',
  'override',
  'suspended',
] as const;
export type EnrollmentAccessState = (typeof ENROLLMENT_ACCESS_STATES)[number];

export const MODULE_CONTENT_KINDS = ['video', 'pdf', 'text', 'quizRef'] as const;
export type ModuleContentKind = (typeof MODULE_CONTENT_KINDS)[number];

export const STORAGE_FOLDERS = [
  'course-pdfs',
  'course-videos',
  'receipts',
  'avatars',
  'ticket-attachments',
] as const;
export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

export const OVERRIDE_ACTIONS = ['cancel', 'reschedule', 'add'] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export const HOLIDAY_KINDS = ['public', 'institutional'] as const;
export type HolidayKind = (typeof HOLIDAY_KINDS)[number];

export const FEE_COMPONENT_KINDS = [
  'registration',
  'tuition',
  'exam',
  'certification',
  'misc',
] as const;
export type FeeComponentKind = (typeof FEE_COMPONENT_KINDS)[number];

export const FEE_COMPONENT_CADENCES = ['one_time', 'monthly_x'] as const;
export type FeeComponentCadence = (typeof FEE_COMPONENT_CADENCES)[number];

export const FEE_DUE_RULES = [
  'on_enrolment',
  'first_of_month',
  'exam_scheduled',
  'month_before_end',
  'manual',
] as const;
export type FeeDueRule = (typeof FEE_DUE_RULES)[number];

export const INVOICE_STATUSES = ['open', 'settled', 'waived', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INSTALLMENT_STATUSES = [
  'pending',
  'partial',
  'paid',
  'overdue',
  'waived',
] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'upi',
  'bank_transfer',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FEE_REMINDER_TEMPLATES = [
  'fees.upcoming.14d',
  'fees.upcoming.7d',
  'fees.due.today',
  'fees.overdue.3d',
  'fees.warning.1',
  'fees.warning.2',
  'fees.suspended',
] as const;
export type FeeReminderTemplate = (typeof FEE_REMINDER_TEMPLATES)[number];

export const TICKET_CATEGORIES = [
  'academic',
  'administration',
  'finance',
  'technical',
  'complaints',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_STATES = [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_COMMENT_VISIBILITY = ['public', 'internal'] as const;
export type TicketCommentVisibility = (typeof TICKET_COMMENT_VISIBILITY)[number];

// M7 — Assessments + Rubric Feedback (TRD §4.9, §4.8; PRD §11, §12)
export const QUIZ_STATES = ['draft', 'scheduled', 'live', 'closed'] as const;
export type QuizState = (typeof QUIZ_STATES)[number];

export const QUIZ_QUESTION_KINDS = ['mcq_single', 'mcq_multi'] as const;
export type QuizQuestionKind = (typeof QUIZ_QUESTION_KINDS)[number];

export const EXAM_QUESTION_KINDS = ['mcq_single', 'mcq_multi', 'essay'] as const;
export type ExamQuestionKind = (typeof EXAM_QUESTION_KINDS)[number];

export const RUBRIC_CRITERION_KINDS = ['numeric', 'scale'] as const;
export type RubricCriterionKind = (typeof RUBRIC_CRITERION_KINDS)[number];

export const FEEDBACK_LEVELS = ['assignment', 'module', 'assessment'] as const;
export type FeedbackLevel = (typeof FEEDBACK_LEVELS)[number];

export const FEEDBACK_STATUSES = ['draft', 'published'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const DOMAIN_EVENT_TYPES = ['course.completed', 'certificate.issued'] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'timetable.change',
  'fees.upcoming.14d',
  'fees.upcoming.7d',
  'fees.due.today',
  'fees.overdue.3d',
  'fees.warning.1',
  'fees.warning.2',
  'fees.suspended',
  'fees.paid',
  'ticket.created',
  'ticket.assigned',
  'ticket.commented',
  'ticket.state_changed',
  'ticket.sla_ack_breached',
  'ticket.sla_resolve_breached',
  // M7 — assessments + feedback (PRD §14.3)
  'assessment.graded',
  'feedback.published',
  // M8 — certificates (PRD §14.3)
  'certificate.issued',
  // Post-M9 — assignments (stakeholder follow-up)
  'assignment.created',
  'assignment.submitted',
  'assignment.graded',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const API_COST_PROVIDERS = ['email', 'whatsapp', 'storage', 'certifier'] as const;
export type ApiCostProvider = (typeof API_COST_PROVIDERS)[number];

export const NOTIFICATION_CHANNELS = ['inapp', 'email', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const AUDIT_ACTIONS = [
  'user.created',
  'user.updated',
  'user.suspended',
  'user.unsuspended',
  'user.deleted',
  'user.invite_resent',
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'auth.invite_accepted',
  'auth.password_reset_requested',
  'auth.password_reset_confirmed',
  'auth.password_changed',
  'program.created',
  'program.updated',
  'program.deleted',
  'course.created',
  'course.updated',
  'course.deleted',
  'course.published',
  'course.unpublished',
  'module.created',
  'module.updated',
  'module.deleted',
  'module.viewed',
  'announcement.created',
  'batch.created',
  'batch.updated',
  'batch.deleted',
  'enrollment.created',
  'enrollment.updated',
  'enrollment.revoked',
  'timetable.entry.created',
  'timetable.entry.updated',
  'timetable.entry.deleted',
  'timetable.override.created',
  'timetable.override.updated',
  'timetable.override.deleted',
  'holiday.created',
  'holiday.deleted',
  'fees.structure.created',
  'fees.structure.updated',
  'fees.invoice.generated',
  'fees.payment.recorded',
  'fees.payment.reversed',
  'fees.receipt.issued',
  'fees.credit_note.issued',
  'fees.reminder.sent',
  'fees.suspension.auto_suspended',
  'fees.suspension.lifted',
  'fees.suspension.override_applied',
  'fees.suspension.override_revoked',
  'jobs.fee_reminders.invoked',
  'jobs.autosuspend.invoked',
  'ticket.created',
  'ticket.assigned',
  'ticket.reassigned',
  'ticket.comment.added',
  'ticket.state_changed',
  'ticket.reopened',
  'ticket.reopen_requested',
  'ticket.sla_ack_breached',
  'ticket.sla_resolve_breached',
  'jobs.sla_timers.invoked',
  // M7 — assessments
  'quiz.created',
  'quiz.updated',
  'quiz.state_changed',
  'quiz.attempt.started',
  'quiz.attempt.submitted',
  'exam.created',
  'exam.updated',
  'exam.state_changed',
  'exam.attempt.started',
  'exam.attempt.submitted',
  'exam.attempt.graded',
  'rubric.created',
  'rubric.updated',
  'rubric.deleted',
  'feedback.created',
  'feedback.updated',
  'feedback.published',
  'enrollment.completed',
  'jobs.faculty_digest.invoked',
  // M8 — certificates + notifications + analytics
  'certificate.issued',
  'certificate.reissue_attempted',
  'certificate.issue_failed',
  'notification.prefs.updated',
  'notification.retry_succeeded',
  'notification.retry_exhausted',
  'jobs.notifications_retry.invoked',
  // Post-M9 — assignments (stakeholder follow-up)
  'assignment.created',
  'assignment.updated',
  'assignment.submission.created',
  'assignment.submission.graded',
  // Post-M9 — curriculum-generator import (Phase A)
  'curriculum.imported',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
