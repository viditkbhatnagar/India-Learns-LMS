import type { DeptTag, Role, SuspensionKind, UserStatus } from '../enums.js';

// M10 — Structured personal-address shape. Captured at apply time on
// ApplicationDraft step3_contact and copied to User at acceptOffer; also
// editable post-conversion via PATCH /v1/users/:id.
export interface PersonalAddressDto {
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

// M10 — Shared shape for emergency contact + parent/guardian. Phone is
// E.164. Email is optional (parents often don't volunteer one).
export interface ContactRefDto {
  name: string;
  relationship: string;
  phoneE164: string;
  email: string | null;
}

export interface UserPublicDto {
  id: string;
  role: Role;
  code: string | null;
  name: string;
  email: string;
  phoneE164: string;
  status: UserStatus;
  suspensionKind: SuspensionKind | null;
  suspensionReason: string | null;
  lastLoginAt: string | null;
  programId: string | null;
  batchId: string | null;
  enrolmentValidFrom: string | null;
  enrolmentValidTo: string | null;
  deptTag: DeptTag | null;
  isCourseCoordinator: boolean;
  address: string | null;
  // M10 — Personal details (nullable for M1–M9 users). dateOfBirth is
  // serialized as an ISO date (YYYY-MM-DD) since hours/minutes are noise.
  dateOfBirth: string | null;
  personalAddress: PersonalAddressDto | null;
  emergencyContact: ContactRefDto | null;
  parentGuardian: ContactRefDto | null;
  // M10f — Placement / Jobs. Single canonical resume URL; null until set.
  resumeUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateUserInput {
  role: Exclude<Role, 'superadmin'>;
  name: string;
  email: string;
  phoneE164: string;
  programId?: string;
  batchId?: string;
  enrolmentValidFrom?: string;
  enrolmentValidTo?: string;
  deptTag?: DeptTag;
  isCourseCoordinator?: boolean;
  // M10v — Optional Section 1 (Academic) details captured at invite
  // time. All four are nullable+optional; the server stores whatever is
  // provided and the student (or admin) can edit later. Document
  // uploads happen after creation on the user detail page.
  dateOfBirth?: string | null;
  personalAddress?: PersonalAddressDto | null;
  emergencyContact?: ContactRefDto | null;
  parentGuardian?: ContactRefDto | null;
}

export interface UpdateUserInput {
  name?: string;
  phoneE164?: string;
  address?: string | null;
  programId?: string | null;
  batchId?: string | null;
  enrolmentValidFrom?: string | null;
  enrolmentValidTo?: string | null;
  deptTag?: DeptTag | null;
  isCourseCoordinator?: boolean;
  // M10 — Personal details. dateOfBirth accepts YYYY-MM-DD; pass null to
  // clear. The contact subdocs require all required fields when set
  // (server validates); pass null to clear an entire subdoc.
  dateOfBirth?: string | null;
  personalAddress?: PersonalAddressDto | null;
  emergencyContact?: ContactRefDto | null;
  parentGuardian?: ContactRefDto | null;
  // M10f — Placement / Jobs resume.
  resumeUrl?: string | null;
}

export interface UserListQuery {
  role?: Role;
  status?: UserStatus;
  programId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  items: UserPublicDto[];
  total: number;
  page: number;
  limit: number;
}
