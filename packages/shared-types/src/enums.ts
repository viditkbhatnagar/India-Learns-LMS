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
  'batch.created',
  'batch.updated',
  'batch.deleted',
  'enrollment.created',
  'enrollment.updated',
  'enrollment.revoked',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
