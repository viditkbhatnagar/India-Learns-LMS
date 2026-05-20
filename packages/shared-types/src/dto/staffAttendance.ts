import type { StaffAttendanceStatus } from '../enums.js';

// M10u — Staff attendance DTO. One row per staff per date (unique).

export interface StaffAttendanceDto {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  date: string; // YYYY-MM-DD (UTC date; displayed in IST in the UI)
  status: StaffAttendanceStatus;
  notes: string | null;
  markedByUserId: string;
  markedByName: string;
  markedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkStaffAttendanceInput {
  /** Omit to mark for the current user (self-mark). Admin can pass another userId. */
  userId?: string;
  /** Omit for "today". Accept YYYY-MM-DD. */
  date?: string;
  status: StaffAttendanceStatus;
  notes?: string | null;
}

export interface StaffAttendanceListResponse {
  items: StaffAttendanceDto[];
  total: number;
  page: number;
  limit: number;
}
