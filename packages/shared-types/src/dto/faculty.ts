import type { EnrollmentStatus, UserStatus } from '../enums.js';

// Faculty account management — admin creates faculty logins with an
// auto-generated password that is persisted (encrypted at rest) and shown
// back in the admin table. `password` is the decrypted current password
// (null for faculty created via the older magic-link invite flow, which
// never stored one).
export interface FacultyAccountDto {
  id: string;
  code: string | null;
  name: string;
  email: string;
  phoneE164: string;
  status: UserStatus;
  password: string | null;
  /** How many courses this faculty is assigned to teach (Course.facultyIds). */
  coursesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFacultyInput {
  name: string;
  email: string;
  phoneE164: string;
}

// Roster row — a student enrolled in a course, shown to the assigned faculty
// (and admins) on the course Students tab.
export interface CourseStudentDto {
  enrollmentId: string;
  studentId: string;
  code: string | null;
  name: string;
  email: string;
  phoneE164: string;
  status: EnrollmentStatus;
  validFrom: string | null;
  validTo: string | null;
}
