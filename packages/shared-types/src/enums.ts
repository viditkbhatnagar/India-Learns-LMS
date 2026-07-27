// M10r — `finance` role removed (D-095). Admin handles every finance
// responsibility now (payments, receipts, fee structures, suspension
// overrides, finance-category tickets). `'finance'` survives as a
// ticket category + dept tag (subject-matter labels), but no user has
// `role: 'finance'` any more.
export const ROLES = [
  'admin',
  'superadmin',
  'faculty',
  'student',
  'applicant',
  'admissions_officer',
] as const;
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
  // Admissions M3a + M3b — applicant-uploaded documents (gov ID, transcripts,
  // resume, portfolio) and referee-uploaded letters of recommendation.
  'application-documents',
  'referee-uploads',
  // M10q — chat attachments + post-conversion student documents + applicant
  // resumes. Same StorageAdapter contract, just different metadata buckets so
  // cleanup + audits can scope by folder.
  'chat-attachments',
  'student-documents',
  'resumes',
  // Showcase — marketing collateral (company profile + program brochures)
  // that staff present in-app from the Showcase section. Large PDFs,
  // ingested via the seed-showcase script (not the 5 MB HTTP upload route).
  'showcase',
] as const;
export type StorageFolder = (typeof STORAGE_FOLDERS)[number];

// Showcase — categories for the marketing PDFs staff can present in-app
// (India Learns company profile + program brochures). Drives the category
// badge + grouping on the Showcase section.
export const SHOWCASE_CATEGORIES = ['profile', 'program', 'brochure', 'other'] as const;
export type ShowcaseCategory = (typeof SHOWCASE_CATEGORIES)[number];

export const SHOWCASE_CATEGORY_LABELS: Record<ShowcaseCategory, string> = {
  profile: 'Company profile',
  program: 'Program brochure',
  brochure: 'Brochure',
  other: 'Document',
};

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
  // M10i — Placement (LMS_Requirements §3 "Notification alerts for new
  // job opportunities").
  'placement.job_posted',
  // M10j — broad-scope announcements (LMS_Requirements §2).
  'announcement.published',
  // M10s — admin gets pinged when a student completes a course (Logan
  // 2026-05-20 "Receives notifications when students complete a course").
  'student.course_completed',
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
  // M10s — manual installment edits (admin-driven, after auto-gen).
  'fees.installment.created',
  'fees.installment.updated',
  'fees.payment.recorded',
  'fees.payment.reversed',
  'fees.receipt.issued',
  'fees.credit_note.issued',
  'fees.credit_note.applied',
  'fees.credit_note.consumed',
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
  // M10 — daily attendance auto-report (LMS_Requirements §2 §5).
  'jobs.daily_attendance.invoked',
  // M8 — certificates + notifications + analytics
  'certificate.issued',
  'certificate.reissue_attempted',
  'certificate.issue_failed',
  'notification.prefs.updated',
  'notification.retry_succeeded',
  'notification.retry_exhausted',
  'jobs.notifications_retry.invoked',
  // Q-M4-03 — nightly retention sweep
  'jobs.notifications_cleanup.invoked',
  'notification.archived',
  // Post-M9 — assignments (stakeholder follow-up)
  'assignment.created',
  'assignment.updated',
  'assignment.submission.created',
  'assignment.submission.graded',
  // Phase B-1 — two-step grading (draft + publish)
  'assignment.submission.draft_saved',
  'assignment.submission.published',
  // Post-M9 — curriculum-generator import (Phase A)
  'curriculum.imported',
  // Phase B-2 — Course→Module→Session tree
  'session.created',
  'session.deleted',
  'session.completed',
  'session.uncompleted',
  'session.reordered',
  'session.updated',
  'session.attendance.recorded',
  // PR #16 — faculty add-material / replace-slides / delete-material
  'material.created',
  'material.deleted',
  'material.slides.replaced',
  // Admissions M1 — applicant signup + officer dashboard view.
  // Future admissions actions land in the separate admissions_audit_logs
  // collection with chain-hash (D-A4) — these few in the legacy AuditLog
  // cover only the User-mutation surface (signup creates a User row).
  'admission.applicant.signed_up',
  // M10s — Visitor Lead lifecycle (admin-captured prospect funnel).
  'visitor_lead.created',
  'visitor_lead.updated',
  'visitor_lead.deleted',
  'visitor_lead.converted',
  // M10u — Staff attendance marking (self-mark + admin override).
  'staff_attendance.marked',
  'staff_attendance.updated',
  // Entrance Exam — isolated temporary-candidate assessment module. Candidate
  // actions carry a null actorUserId (candidates are not Users); the candidate
  // id travels in `details`. Admin actions (exam window/state, Q20 grading)
  // carry the acting staff user id as actor.
  'entrance.candidate.login',
  'entrance.attempt.started',
  'entrance.attempt.submitted',
  'entrance.attempt.graded',
  'entrance.exam.updated',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Admissions M3a / M10 — document type slots an admin can require on a
// program, and the storage-level types we persist on ApplicationDocument.
//
// `PROGRAM_REQUIRED_DOC_TYPES` is what an officer / admin can mark required
// when configuring a program. `APPLICATION_DOCUMENT_TYPES` is the full set
// of types we accept as uploaded files — it is the program-required set
// plus `referee_letter`, which is uploaded by referees via the M3b
// tokenized flow and is not configurable per-program.
//
// M10 (LMS_Requirements.docx §1) added the five Indian-school document
// types — SSLC, Plus Two, Degree, Transfer Certificate, Passport-size photo
// — to support the LUC India Learns admissions workflow. Old applications
// uploaded under `other` continue to work (we don't backfill).
export const PROGRAM_REQUIRED_DOC_TYPES = [
  'govid',
  'transcript',
  'resume',
  'portfolio',
  'test_score',
  'sslc',
  'plus_two',
  'degree',
  'transfer_certificate',
  'passport_photo',
  'other',
] as const;
export type ProgramRequiredDocType = (typeof PROGRAM_REQUIRED_DOC_TYPES)[number];

export const APPLICATION_DOCUMENT_TYPES = [
  ...PROGRAM_REQUIRED_DOC_TYPES,
  'referee_letter',
] as const;
export type ApplicationDocumentType = (typeof APPLICATION_DOCUMENT_TYPES)[number];

// Human-readable labels used in UI selects, audit log payloads, and the
// applicant-facing Step-6 uploader. Keep in sync with the constants above.
export const APPLICATION_DOCUMENT_TYPE_LABELS: Record<ApplicationDocumentType, string> = {
  govid: 'Government ID',
  transcript: 'Prior transcript',
  resume: 'Resume / CV',
  portfolio: 'Portfolio',
  test_score: 'Test score report',
  sslc: 'Class 10 (SSLC) certificate',
  plus_two: 'Class 12 / Plus Two certificate',
  degree: 'Degree certificate',
  transfer_certificate: 'Transfer certificate (TC)',
  passport_photo: 'Passport-size photo',
  other: 'Supporting document',
  referee_letter: 'Letter of recommendation',
};

// M10 — Placement / Jobs module (LMS_Requirements §3).
//
// `JobPosting` lifecycle: draft (admin curating) → published (visible to
// students) → closed (deadline passed or filled). `JobApplication`
// lifecycle is the typical funnel from applied through to selected /
// rejected / withdrawn; statuses align with what placement teams already
// track in spreadsheets so the import path is short.
export const JOB_EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'internship',
  'contract',
] as const;
export type JobEmploymentType = (typeof JOB_EMPLOYMENT_TYPES)[number];

export const JOB_POSTING_STATES = ['draft', 'published', 'closed'] as const;
export type JobPostingState = (typeof JOB_POSTING_STATES)[number];

export const JOB_APPLICATION_STATUSES = [
  'applied',
  'shortlisted',
  'interview_scheduled',
  'selected',
  'rejected',
  'withdrawn',
] as const;
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

// Admissions module (M1+) — application lifecycle state.
// Decisions are recorded on the Application as terminal transitions; the
// state machine guards in routes/services enforce legal transitions.
export const APPLICATION_STATES = [
  'draft',
  'submitted',
  'under_review',
  'decision_pending',
  'admitted',
  'denied',
  'waitlisted',
  'withdrawn',
] as const;
export type ApplicationState = (typeof APPLICATION_STATES)[number];

// Admissions M2 — per-program admission target mode. `cohort_pick` shows
// applicants the open batches at Step 4; `program_only` defers cohort
// assignment to the officer at admit time (D-A3).
export const ADMISSION_MODES = ['cohort_pick', 'program_only'] as const;
export type AdmissionMode = (typeof ADMISSION_MODES)[number];

// Admissions M5+ — tamper-evident audit actions (D-A4). These are recorded
// to `admissions_audit_logs` (separate collection, chain-hash, service-layer
// append-only). M1 only emits `applicant.signed_up` and `officer.viewed`.
export const ADMISSIONS_AUDIT_ACTIONS = [
  'applicant.signed_up',
  'officer.viewed_dashboard',
  'officer.viewed_application',
  'application.draft_saved',
  'application.submitted',
  'application.withdrawn',
  'officer.note_added',
  'officer.decision.admit',
  'officer.decision.deny',
  'officer.decision.waitlist',
  'applicant.offer.accepted',
  'applicant.offer.declined',
  'applicant.converted_to_student',
  'application_fee.recorded',
  'application_fee.waived',
] as const;
export type AdmissionsAuditAction = (typeof ADMISSIONS_AUDIT_ACTIONS)[number];

// M10u — Staff attendance (LMS_Requirements §4 "Attendance management
// for students and staff"). Faculty self-marks per day; admin can
// override / mark on behalf.
export const STAFF_ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'leave',
  'half_day',
] as const;
export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

// M10s — Visitor Leads (LMS Visitor List Template, per Logan 2026-05-20).
// Captured by admin / admissions staff; pre-application stage. Convert
// path: VisitorLead → ApplicationDraft when the lead becomes a real
// applicant.
export const VISITOR_QUALIFICATIONS = [
  'high_school',
  'bba',
  'btech',
  'graduate',
  'other',
] as const;
export type VisitorQualification = (typeof VISITOR_QUALIFICATIONS)[number];

export const VISITOR_LEAD_SOURCES = [
  'reference',
  'google',
  'social_media',
  'walk_in',
  'meta',
  'agent',
  'other',
] as const;
export type VisitorLeadSource = (typeof VISITOR_LEAD_SOURCES)[number];

export const VISITOR_OTP_STATUSES = ['pending', 'verified'] as const;
export type VisitorOtpStatus = (typeof VISITOR_OTP_STATUSES)[number];

export const VISITOR_LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'dropped',
] as const;
export type VisitorLeadStatus = (typeof VISITOR_LEAD_STATUSES)[number];

// M10s — `student.course_completed` extends the existing notification
// catalogue so admin gets pinged when a student finishes a course
// (mirrors the certificate-issue flow).
