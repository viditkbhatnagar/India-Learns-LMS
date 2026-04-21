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
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
