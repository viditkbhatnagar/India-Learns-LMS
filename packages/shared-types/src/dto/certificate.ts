// M8 — Certificate DTO (TRD §5.10, PRD §13)
// Certificate state lives on Enrollment (fields `certificateUrl`,
// `certificateIssuedAt`, `certificateProviderId`, `certificateIssueError`).
// This DTO is the over-the-wire shape returned by
// `POST /v1/enrollments/:id/issue-certificate` and `GET /v1/me/certificates`.
export interface CertificateDto {
  enrollmentId: string;
  studentId: string;
  courseId: string;
  courseName: string;
  programId: string;
  completedAt: string;
  certificateUrl: string | null;
  providerId: string | null;
  issuedAt: string | null;
  issueError: string | null;
}
