import type { DeptTag, Role, SuspensionKind, UserStatus } from '../enums.js';

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
