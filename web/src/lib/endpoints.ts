import type {
  AcceptOfferResult,
  AddRefereeInput,
  AddReviewerNoteInput,
  AdmissionsAnalyticsDto,
  AdmissionsAuditChainDto,
  AnalyticsSummaryDto,
  ApplicantSignupInput,
  ApplicationDecisionInput,
  ApplicationDocumentDto,
  ApplicationDraftDto,
  ApplicationDto,
  ApplicationFeeDto,
  ApplicationPaymentDto,
  ApplicationState,
  AssignCohortInput,
  CertificateDto,
  OfficerApplicationDetailDto,
  PublicCohortDto,
  PublicProgramDto,
  RecordApplicationPaymentInput,
  RefereeDto,
  RefereeUploadContextDto,
  RegisterDocumentInput,
  ReviewerNoteDto,
  SaveDraftInput,
  SaveStatementInput,
  SignDocumentUploadInput,
  SignedUploadTicketDto,
  SubmitApplicationInput,
  WaiveApplicationFeeInput,
  WithdrawApplicationInput,
  CollectionsReportDto,
  CourseDto,
  CreateTicketInput,
  EnrollmentDto,
  ExamAttemptDto,
  ExamDto,
  FeedbackEntryDto,
  ApplyToJobInput,
  AssignmentSubmissionsReportDto,
  AttendanceReportDto,
  BatchSummaryReportDto,
  ChatMessageDto,
  CompanyDto,
  ConversationDto,
  CreateCompanyInput,
  CreateJobPostingInput,
  HolidayDto,
  JobApplicationDto,
  JobPostingDto,
  SendChatMessageInput,
  PlacementAnalyticsDto,
  UpdateCompanyInput,
  UpdateJobApplicationInput,
  UpdateJobPostingInput,
  InvoiceDto,
  ModuleDto,
  NotificationDto,
  NotificationPrefsDto,
  OutstandingFeesDto,
  PaymentDto,
  ProgramDto,
  ProgramRequiredDocType,
  QuizAttemptDto,
  QuizDto,
  ReceiptDto,
  StudentCourseViewDto,
  StudentDashboardDto,
  StudentFeesDto,
  TicketCommentDto,
  TicketDto,
  TicketState,
  TimetableOccurrenceDto,
  UserPublicDto,
  VisitorLeadDto,
  CreateVisitorLeadInput,
  UpdateVisitorLeadInput,
  VisitorLeadSource,
  VisitorLeadStatus,
  VisitorOtpStatus,
  MarkStaffAttendanceInput,
  StaffAttendanceDto,
  StaffAttendanceStatus,
} from 'india-learns-shared-types';
import { api, unwrap } from './api.js';
import { getDeviceId } from './deviceId.js';

export const authApi = {
  async login(email: string, password: string) {
    const res = await api.post<{
      data: { user: UserPublicDto; accessToken: string };
    }>('/auth/login', { email, password, deviceId: getDeviceId() });
    return res.data.data;
  },
  async logout() {
    await api.post('/auth/logout', {});
  },
  async me() {
    const res = await api.get<{ data: { user: UserPublicDto } }>('/users/me');
    return res.data.data.user;
  },
  async requestPasswordReset(email: string) {
    await api.post('/auth/password/reset/request', { email });
  },
  async confirmPasswordReset(token: string, password: string) {
    await api.post('/auth/password/reset/confirm', { token, password });
  },
  async acceptInvite(token: string, password: string) {
    const res = await api.post<{
      data: { user: UserPublicDto; accessToken: string };
    }>('/auth/invite/accept', { token, password, deviceId: getDeviceId() });
    return res.data.data;
  },
  async changePassword(current: string, next: string) {
    await api.post('/auth/password/change', { current, next });
  },
};

export const usersApi = {
  async list(params: { role?: string; status?: string; programId?: string; q?: string } = {}) {
    const res = await api.get<{ data: { items: UserPublicDto[] } }>('/users', {
      params,
    });
    return unwrap<{ items: UserPublicDto[] }>(res).items;
  },
  async get(id: string) {
    const res = await api.get<{ data: { user: UserPublicDto } }>(`/users/${id}`);
    return res.data.data.user;
  },
  async create(input: {
    role: string;
    name: string;
    email: string;
    phoneE164?: string;
    programId?: string;
    batchId?: string;
    // M10v — Section 1 (Academic) details optionally captured at invite
    // time. All four are nullable; the service stores whatever is set.
    dateOfBirth?: string | null;
    personalAddress?: {
      street: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    } | null;
    emergencyContact?: {
      name: string;
      relationship: string;
      phoneE164: string;
      email: string | null;
    } | null;
    parentGuardian?: {
      name: string;
      relationship: string;
      phoneE164: string;
      email: string | null;
    } | null;
    // M10x — Marketing source attribution (Excel "Source" column).
    source?: UserPublicDto['source'];
  }) {
    const res = await api.post<{ data: { user: UserPublicDto } }>('/users', input);
    return res.data.data.user;
  },
  // M10h — Admin can edit the full set of student personal + admission
  // details. Pass null on a subdoc field to clear it; the server's Zod
  // schema enforces shape.
  async update(
    id: string,
    input: Partial<{
      name: string;
      email: string;
      phoneE164: string;
      address: string | null;
      programId: string | null;
      batchId: string | null;
      enrolmentValidFrom: string | null;
      enrolmentValidTo: string | null;
      dateOfBirth: string | null;
      personalAddress: UserPublicDto['personalAddress'];
      emergencyContact: UserPublicDto['emergencyContact'];
      parentGuardian: UserPublicDto['parentGuardian'];
      resumeUrl: string | null;
      // M10x — Marketing source attribution.
      source: UserPublicDto['source'];
    }>,
  ) {
    const res = await api.patch<{ data: { user: UserPublicDto } }>(`/users/${id}`, input);
    return res.data.data.user;
  },
  // M10 — Profile-screen fields included: dateOfBirth (YYYY-MM-DD or null),
  // structured personalAddress, emergencyContact, parentGuardian. Pass null
  // on any subdoc to clear it.
  async updateMe(input: {
    name?: string;
    phoneE164?: string;
    address?: string | null;
    dateOfBirth?: string | null;
    personalAddress?: UserPublicDto['personalAddress'];
    emergencyContact?: UserPublicDto['emergencyContact'];
    parentGuardian?: UserPublicDto['parentGuardian'];
    // M10f — Placement resume URL.
    resumeUrl?: string | null;
  }) {
    // Server accepts PATCH /users/:id where :id === self.
    const me = await api.get<{ data: { user: UserPublicDto } }>('/users/me');
    const res = await api.patch<{ data: { user: UserPublicDto } }>(
      `/users/${me.data.data.user.id}`,
      input,
    );
    return res.data.data.user;
  },
  async suspend(id: string, reason: string) {
    await api.post(`/users/${id}/suspend`, { reason });
  },
  async unsuspend(id: string) {
    await api.post(`/users/${id}/unsuspend`, {});
  },
  async resendInvite(id: string) {
    await api.post(`/users/${id}/resend-invite`, {});
  },
};

export const studentsApi = {
  async dashboard() {
    const res = await api.get<{ data: StudentDashboardDto }>('/students/me/dashboard');
    return res.data.data;
  },
  async fees() {
    const res = await api.get<{ data: { fees: StudentFeesDto } }>('/students/me/fees');
    return res.data.data.fees;
  },
  async feesFor(studentId: string) {
    const res = await api.get<{ data: { fees: StudentFeesDto } }>(`/students/${studentId}/fees`);
    return res.data.data.fees;
  },
};

export const programsApi = {
  async list() {
    const res = await api.get<{ data: { items: ProgramDto[] } }>('/programs');
    return res.data.data.items;
  },
  async get(id: string) {
    const res = await api.get<{ data: { program: ProgramDto } }>(`/programs/${id}`);
    return res.data.data.program;
  },
  async create(input: { name: string; slug: string; description?: string; totalHours?: number }) {
    const res = await api.post<{ data: { program: ProgramDto } }>('/programs', input);
    return res.data.data.program;
  },
  async update(
    id: string,
    patch: Partial<{
      name: string;
      slug: string;
      description: string;
      totalHours: number;
      isActive: boolean;
      // Admissions config — added with the M5+ admin UI.
      admissionsEnabled: boolean;
      admissionMode: 'cohort_pick' | 'program_only';
      applicationFeePaise: number;
      requiredDocs: Array<{
        // M10 — Sourced from shared-types so SSLC / Plus Two / Degree /
        // Transfer Certificate / Passport Photo are accepted here too.
        documentType: ProgramRequiredDocType;
        label: string;
        required: boolean;
      }>;
      requiresStatement: boolean;
      requiresReferences: boolean;
      referencesMinCount: number;
      referencesMaxCount: number;
      statementWordLimit: number;
    }>,
  ) {
    const res = await api.patch<{ data: { program: ProgramDto } }>(`/programs/${id}`, patch);
    return res.data.data.program;
  },
};

export interface AssignmentDto {
  id: string;
  courseId: string;
  moduleId: string | null;
  authorUserId: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxScore: number;
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus =
  | 'submitted'
  | 'needs_grading'
  | 'graded_draft'
  | 'published';

export interface AssignmentSubmissionRubricScore {
  criterionIndex: number;
  score: number;
  comment: string;
}

export interface AssignmentSubmissionDto {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  bodyText: string;
  attachmentUrl: string | null;
  submittedAt: string;
  status: SubmissionStatus;
  lateFlag: boolean;
  score: number | null;
  feedback: string | null;
  rubricScores: AssignmentSubmissionRubricScore[];
  gradedByUserId: string | null;
  gradedAt: string | null;
  publishedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentWithMine extends AssignmentDto {
  mySubmission: AssignmentSubmissionDto | null;
}

export interface AssignmentSubmissionWithStudent extends AssignmentSubmissionDto {
  student: { id: string; name: string; email: string; code: string | null } | null;
}

export const assignmentsApi = {
  async listForCourse(courseId: string) {
    const res = await api.get<{ data: { items: AssignmentWithMine[] } }>(
      `/courses/${courseId}/assignments`,
    );
    return res.data.data.items;
  },
  async createOnCourse(
    courseId: string,
    input: {
      title: string;
      instructions: string;
      dueAt: string;
      maxScore: number;
      moduleId?: string | null;
    },
  ) {
    const res = await api.post<{ data: { assignment: AssignmentDto } }>(
      `/courses/${courseId}/assignments`,
      input,
    );
    return res.data.data.assignment;
  },
  async createOnSession(
    sessionId: string,
    input: {
      title: string;
      instructions: string;
      dueAt: string;
      maxScore: number;
    },
  ) {
    const res = await api.post<{ data: { assignment: AssignmentDto } }>(
      `/sessions/${sessionId}/assignments`,
      input,
    );
    return res.data.data.assignment;
  },
  async get(id: string) {
    const res = await api.get<{
      data: { assignment: AssignmentDto; mySubmission: AssignmentSubmissionDto | null };
    }>(`/assignments/${id}`);
    return res.data.data;
  },
  async update(id: string, input: Partial<{ title: string; instructions: string; dueAt: string; maxScore: number; state: 'open' | 'closed' }>) {
    const res = await api.patch<{ data: { assignment: AssignmentDto } }>(
      `/assignments/${id}`,
      input,
    );
    return res.data.data.assignment;
  },
  async submit(id: string, input: { bodyText?: string; attachmentUrl?: string | null }) {
    const res = await api.post<{ data: { submission: AssignmentSubmissionDto } }>(
      `/assignments/${id}/submissions`,
      input,
    );
    return res.data.data.submission;
  },
  async listSubmissions(
    id: string,
    params: { status?: 'needs_grading' | 'graded' | 'drafts' | 'published' | 'missing' } = {},
  ) {
    const res = await api.get<{
      data: {
        items: AssignmentSubmissionWithStudent[];
        missing?: Array<{
          assignmentId: string;
          studentId: string;
          student: { id: string; name: string; email: string; code: string | null } | null;
          dueAt: string;
        }>;
      };
    }>(`/assignments/${id}/submissions`, { params });
    return {
      items: res.data.data.items,
      missing: res.data.data.missing ?? [],
    };
  },
  async saveDraft(
    submissionId: string,
    input: {
      score: number;
      feedback?: string;
      rubricScores?: Array<{ criterionIndex: number; score: number; comment?: string }>;
    },
  ) {
    const res = await api.post<{ data: { submission: AssignmentSubmissionDto } }>(
      `/assignment-submissions/${submissionId}/draft`,
      input,
    );
    return res.data.data.submission;
  },
  async publish(submissionId: string) {
    const res = await api.post<{ data: { submission: AssignmentSubmissionDto } }>(
      `/assignment-submissions/${submissionId}/publish`,
      {},
    );
    return res.data.data.submission;
  },
  async bulkPublish(submissionIds: string[]) {
    const res = await api.post<{
      data: {
        published: string[];
        skipped: Array<{ submissionId: string; reason: string }>;
        failed: Array<{ submissionId: string; reason: string }>;
      };
    }>('/assignment-submissions/bulk-publish', { submissionIds });
    return res.data.data;
  },
  async gradebook(courseId: string) {
    const res = await api.get<{
      data: {
        course: { id: string; name: string };
        students: Array<{ id: string; name: string; email: string; code: string | null }>;
        assignments: Array<{
          id: string;
          title: string;
          dueAt: string;
          maxScore: number;
          deliveryVariant: string | null;
          moduleId: string | null;
          sessionId: string | null;
        }>;
        cells: Array<{
          assignmentId: string;
          studentId: string;
          submissionId: string | null;
          computedStatus: SubmissionStatus | 'not_started' | 'missing';
          score: number | null;
          isDraft: boolean;
          lateFlag: boolean;
          publishedAt: string | null;
          gradedAt: string | null;
        }>;
        backlog: number;
        publishedCount: number;
        draftCount: number;
      };
    }>(`/courses/${courseId}/gradebook`);
    return res.data.data;
  },
};

export const modulesApi = {
  async createOnCourse(courseId: string, input: { title: string; order: number }) {
    const res = await api.post<{ data: { module: ModuleDto } }>(
      `/courses/${courseId}/modules`,
      input,
    );
    return res.data.data.module;
  },
  async get(id: string) {
    const res = await api.get<{ data: { module: ModuleDto } }>(`/modules/${id}`);
    return res.data.data.module;
  },
  async update(
    id: string,
    patch: {
      title?: string;
      order?: number;
      aim?: string;
      prerequisites?: string[];
      facultyNotes?: string;
      syllabus?: string;
    },
  ) {
    const res = await api.patch<{ data: { module: ModuleDto } }>(
      `/modules/${id}`,
      patch,
    );
    return res.data.data.module;
  },
};

export interface AnnouncementDto {
  id: string;
  courseId: string;
  authorUserId: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const announcementsApi = {
  async list(courseId: string) {
    const res = await api.get<{ data: { items: AnnouncementDto[] } }>(
      `/courses/${courseId}/announcements`,
    );
    return res.data.data.items;
  },
  async create(courseId: string, input: { subject: string; body: string }) {
    const res = await api.post<{ data: { announcement: AnnouncementDto } }>(
      `/courses/${courseId}/announcements`,
      input,
    );
    return res.data.data.announcement;
  },
};

export const coursesApi = {
  async list() {
    const res = await api.get<{ data: { items: CourseDto[] } }>('/courses');
    return res.data.data.items;
  },
  async get(id: string) {
    // /courses/:id returns only { course }; modules live on a separate
    // endpoint. Fetch both in parallel so callers get the combined shape
    // they already expect.
    const [courseRes, modulesRes] = await Promise.all([
      api.get<{ data: { course: CourseDto } }>(`/courses/${id}`),
      api.get<{ data: { items: ModuleDto[] } }>(`/courses/${id}/modules`),
    ]);
    return {
      course: courseRes.data.data.course,
      modules: modulesRes.data.data.items,
    };
  },
  async create(input: { programId: string; name: string; slug: string; summary?: string }) {
    const res = await api.post<{ data: { course: CourseDto } }>('/courses', input);
    return res.data.data.course;
  },
  /**
   * Partial course update. Today only `facultyIds` is wired in the UI,
   * but the server-side `UpdateCourseInput` supports name / slug /
   * summary / sequential / certificateTemplateId too — extend the
   * patch shape here as those screens land.
   */
  async update(id: string, patch: { facultyIds?: string[]; summary?: string; sequential?: boolean }) {
    const res = await api.patch<{ data: { course: CourseDto } }>(`/courses/${id}`, patch);
    return res.data.data.course;
  },
  async publish(id: string) {
    await api.post(`/courses/${id}/publish`, {});
  },
  async unpublish(id: string) {
    await api.post(`/courses/${id}/unpublish`, {});
  },
  async delete(id: string) {
    await api.delete(`/courses/${id}`);
  },
};

export interface StudentSessionDto {
  id: string;
  moduleId: string;
  courseId: string;
  number: number;
  orderIndex: number;
  title: string;
  description: string;
  type: 'lecture' | 'seminar' | 'workshop' | 'tutorial' | 'lab' | 'assessment' | 'exam';
  plannedMinutes: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  status: 'upcoming' | 'in_progress' | 'completed';
  completedAt: string | null;
  isAutoGenerated: boolean;
}

export interface MeCourseDetailDto {
  course: CourseDto;
  enrolment: EnrollmentDto;
  modules: ModuleDto[];
  sessions: StudentSessionDto[];
  assignments: AssignmentWithMine[];
}

export const meCoursesApi = {
  async list() {
    const res = await api.get<{ data: { enrolments: EnrollmentDto[] } }>('/me/courses');
    return res.data.data.enrolments;
  },
  async get(courseId: string): Promise<MeCourseDetailDto> {
    const res = await api.get<{ data: MeCourseDetailDto }>(`/me/courses/${courseId}`);
    return res.data.data;
  },
  /**
   * Aggregated student-view payload — single call, fully nested
   * Module → Session → Assignment tree with progress rollups + a
   * pre-sorted "needs your attention" panel. Used by the new student
   * course page (PR #16 Phases 4–6).
   */
  async studentView(courseId: string): Promise<StudentCourseViewDto> {
    const res = await api.get<{ data: StudentCourseViewDto }>(
      `/me/courses/${courseId}/student-view`,
    );
    return res.data.data;
  },
  /**
   * Student-side session detail. Returns the session metadata plus
   * materials (slide JSON inlined for type=slides) plus the calling
   * student's assignment-submission state.
   */
  async studentSession(courseId: string, sessionId: string): Promise<StudentSessionDetail> {
    const res = await api.get<{ data: StudentSessionDetail }>(
      `/me/courses/${courseId}/sessions/${sessionId}`,
    );
    return res.data.data;
  },
};

export interface StudentSessionDetailMaterial {
  id: string;
  type: string;
  title: string;
  url: string | null;
  slideCount: number | null;
  body: unknown | null;
}

export interface StudentSessionDetail {
  course: { id: string; title: string };
  session: {
    id: string;
    moduleId: string;
    courseId: string;
    order: number;
    title: string;
    description: string;
    type: string;
    plannedMinutes: number | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    location: string | null;
    status: 'upcoming' | 'in_progress' | 'completed';
    completedAt: string | null;
  };
  materials: StudentSessionDetailMaterial[];
  assignments: Array<{
    id: string;
    title: string;
    dueAt: string;
    maxPoints: number;
    score: number | null;
    feedback: string | null;
    status: 'graded' | 'submitted' | 'late' | 'dueSoon' | 'upcoming';
    daysUntilDue: number;
  }>;
}

export const enrollmentsApi = {
  async listMine() {
    const res = await api.get<{ data: { items: EnrollmentDto[] } }>('/enrollments/me');
    return res.data.data.items;
  },
  async get(id: string) {
    const res = await api.get<{ data: { enrollment: EnrollmentDto } }>(`/enrollments/${id}`);
    return res.data.data.enrollment;
  },
  async issueCertificate(id: string) {
    const res = await api.post<{ data: { certificate: CertificateDto; reissued: boolean } }>(
      `/enrollments/${id}/issue-certificate`,
      {},
    );
    return res.data.data;
  },
};

export const timetableApi = {
  async mine(params: { week?: string; from?: string; to?: string } = {}) {
    const res = await api.get<{
      data: { window: { from: string; to: string }; occurrences: TimetableOccurrenceDto[] };
    }>('/me/timetable', { params });
    return res.data.data.occurrences;
  },
  async forBatch(batchId: string, from: string, to: string) {
    const res = await api.get<{ data: { items: TimetableOccurrenceDto[] } }>('/timetable', {
      params: { batchId, from, to },
    });
    return res.data.data.items;
  },
};

export const holidaysApi = {
  async list() {
    const res = await api.get<{ data: { items: HolidayDto[] } }>('/holidays');
    return res.data.data.items;
  },
};

export const notificationsApi = {
  async listMine(opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const res = await api.get<{ data: { items: NotificationDto[] } }>('/me/notifications', {
      params: {
        ...(opts.unreadOnly ? { unreadOnly: 'true' } : {}),
        ...(opts.limit ? { limit: opts.limit } : {}),
      },
    });
    return res.data.data.items;
  },
  async markRead(id: string) {
    await api.post(`/me/notifications/${id}/read`, {});
  },
  async getPrefs() {
    const res = await api.get<{ data: NotificationPrefsDto }>('/me/notification-prefs');
    return res.data.data;
  },
  async updatePrefs(body: {
    emailByType?: Record<string, boolean>;
    whatsappByType?: Record<string, boolean>;
  }) {
    const res = await api.patch<{ data: NotificationPrefsDto }>('/me/notification-prefs', body);
    return res.data.data;
  },
};

export const certificatesApi = {
  async listMine() {
    const res = await api.get<{ data: { items: CertificateDto[] } }>('/me/certificates');
    return res.data.data.items;
  },
};

export const ticketsApi = {
  async listMine() {
    const res = await api.get<{ data: { tickets: TicketDto[] } }>('/me/tickets');
    return res.data.data.tickets;
  },
  async listStaff() {
    const res = await api.get<{ data: { tickets: TicketDto[] } }>('/staff/tickets');
    return res.data.data.tickets;
  },
  async listAdmin(params: { category?: string; state?: string; slaBreached?: string } = {}) {
    const res = await api.get<{ data: { tickets: TicketDto[] } }>('/tickets', { params });
    return res.data.data.tickets;
  },
  async get(id: string) {
    const res = await api.get<{
      data: { ticket: TicketDto; comments: TicketCommentDto[] };
    }>(`/tickets/${id}`);
    return res.data.data;
  },
  async create(input: CreateTicketInput) {
    const res = await api.post<{ data: { ticket: TicketDto } }>('/tickets', input);
    return res.data.data.ticket;
  },
  async addComment(
    id: string,
    body: string,
    visibility?: 'public' | 'internal',
    mentionUserIds?: string[],
  ) {
    const payload: Record<string, unknown> = { body };
    if (visibility) payload.visibility = visibility;
    if (mentionUserIds && mentionUserIds.length > 0) payload.mentionUserIds = mentionUserIds;
    const res = await api.post<{ data: { comment: TicketCommentDto } }>(
      `/tickets/${id}/comments`,
      payload,
    );
    return res.data.data.comment;
  },
  async transition(id: string, input: { to: TicketState; note?: string }) {
    const res = await api.post<{ data: { ticket: TicketDto } }>(`/tickets/${id}/state`, input);
    return res.data.data.ticket;
  },
  async assign(
    id: string,
    assigneeUserId: string | null,
    coAssigneeUserIds?: string[],
  ) {
    const payload: Record<string, unknown> = { assigneeUserId };
    if (coAssigneeUserIds !== undefined) payload.coAssigneeUserIds = coAssigneeUserIds;
    const res = await api.post<{ data: { ticket: TicketDto } }>(
      `/tickets/${id}/assign`,
      payload,
    );
    return res.data.data.ticket;
  },
  async requestReopen(id: string, note?: string) {
    const res = await api.post<{ data: { ticket: TicketDto } }>(
      `/tickets/${id}/reopen-request`,
      { note },
    );
    return res.data.data.ticket;
  },
  async reopen(id: string, note?: string) {
    const res = await api.post<{ data: { ticket: TicketDto } }>(
      `/tickets/${id}/reopen`,
      { note },
    );
    return res.data.data.ticket;
  },
};

export const feesApi = {
  async feeStructures() {
    const res = await api.get<{ data: { items: unknown[] } }>('/fee-structures');
    return res.data.data.items;
  },
  async createFeeStructure(input: { name: string; programId: string; totalPaise: number; components: unknown[] }) {
    const res = await api.post<{ data: { feeStructure: unknown } }>('/fee-structures', input);
    return res.data.data.feeStructure;
  },
  async invoices(params: { studentId?: string } = {}) {
    const res = await api.get<{ data: { items: InvoiceDto[] } }>('/invoices', { params });
    return res.data.data.items;
  },
  async listPayments(params: { from?: string; to?: string } = {}) {
    const res = await api.get<{ data: { items: PaymentDto[] } }>('/payments', { params });
    return res.data.data.items;
  },
  async getPayment(id: string) {
    const res = await api.get<{ data: { payment: PaymentDto; receipt?: ReceiptDto } }>(`/payments/${id}`);
    return res.data.data;
  },
  async recordPayment(input: {
    studentId: string;
    amountPaise: number;
    method: string;
    reference?: string;
    receivedAt?: string;
    notes?: string;
  }) {
    const res = await api.post<{ data: { payment: PaymentDto; receipt?: ReceiptDto } }>(
      '/payments',
      input,
    );
    return res.data.data;
  },
  async reversePayment(id: string) {
    const res = await api.post<{ data: { payment: PaymentDto } }>(`/payments/${id}/reverse`, {});
    return res.data.data.payment;
  },
};

// Admin-only resources used by the M9 deep-CRUD screens. Endpoints exist on
// the API since M3–M6; the wrappers were missing from the M8 web port.
export const batchesApi = {
  async list() {
    const res = await api.get<{ data: { items: unknown[] } }>('/batches');
    return res.data.data.items;
  },
  async get(id: string) {
    const res = await api.get<{ data: { batch: unknown } }>(`/batches/${id}`);
    return res.data.data.batch;
  },
  async create(input: { name: string; programId: string; capacity: number; startDate: string; endDate?: string }) {
    const res = await api.post<{ data: { batch: unknown } }>('/batches', input);
    return res.data.data.batch;
  },
  async update(
    id: string,
    input: Partial<{
      name: string;
      capacity: number;
      startDate: string;
      endDate: string;
      status: string;
      // Admissions M5+ — admin toggles for the public cohort feed.
      openForApplications: boolean;
      seatsRemaining: number;
    }>,
  ) {
    const res = await api.patch<{ data: { batch: unknown } }>(`/batches/${id}`, input);
    return res.data.data.batch;
  },
  async timetable(id: string) {
    const res = await api.get<{ data: { items: unknown[] } }>(`/batches/${id}/timetable`);
    return res.data.data.items;
  },
};

// M10 — Reports module (LMS_Faculty_Features §4). JSON for preview,
// `format=xlsx` for download. The `download*` helpers return a Blob the
// caller saves with createObjectURL + an <a download>.
export const reportsApi = {
  async attendance(query: {
    batchId: string;
    from: string;
    to: string;
    courseId?: string;
  }): Promise<AttendanceReportDto> {
    const res = await api.get<{ data: AttendanceReportDto }>('/reports/attendance', {
      params: query,
    });
    return res.data.data;
  },
  async batchSummary(query: { batchId: string }): Promise<BatchSummaryReportDto> {
    const res = await api.get<{ data: BatchSummaryReportDto }>('/reports/batch-summary', {
      params: query,
    });
    return res.data.data;
  },
  async assignmentSubmissions(query: {
    batchId: string;
    from: string;
    to: string;
    courseId?: string;
  }): Promise<AssignmentSubmissionsReportDto> {
    const res = await api.get<{ data: AssignmentSubmissionsReportDto }>(
      '/reports/assignment-submissions',
      { params: query },
    );
    return res.data.data;
  },
  async downloadXlsx(
    kind: 'attendance' | 'batch-summary' | 'assignment-submissions',
    query: Record<string, string>,
  ): Promise<Blob> {
    const res = await api.get<Blob>(`/reports/${kind}`, {
      params: { ...query, format: 'xlsx' },
      responseType: 'blob',
    });
    return res.data;
  },
  // M10i — Generic download for either Excel or PDF format.
  async download(
    kind: 'attendance' | 'batch-summary' | 'assignment-submissions',
    format: 'xlsx' | 'pdf',
    query: Record<string, string>,
  ): Promise<Blob> {
    const res = await api.get<Blob>(`/reports/${kind}`, {
      params: { ...query, format },
      responseType: 'blob',
    });
    return res.data;
  },
};

// M10o — Per-batch sessions on a date. Powers /faculty/batches/:id/attendance.
export interface BatchSessionSummary {
  id: string;
  courseId: string;
  courseName: string;
  moduleId: string;
  title: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'planned' | 'completed' | 'cancelled' | 'unscheduled';
  attendanceRecorded: number;
  enrolledStudents: number;
}

export const batchSessionsApi = {
  async list(batchId: string, dateIsoYmd?: string): Promise<{
    sessions: BatchSessionSummary[];
    date: string;
  }> {
    const res = await api.get<{
      data: { sessions: BatchSessionSummary[]; date: string };
    }>(`/batches/${batchId}/sessions`, {
      params: dateIsoYmd ? { date: dateIsoYmd } : {},
    });
    return res.data.data;
  },
};

export const timetableEntriesApi = {
  async createEntry(batchId: string, input: { courseId: string; facultyId: string; weekday: number; startMinute: number; endMinute: number; room: string }) {
    const res = await api.post<{ data: { entry: unknown } }>(`/batches/${batchId}/timetable`, input);
    return res.data.data.entry;
  },
  async updateEntry(entryId: string, input: Partial<{ courseId: string; facultyId: string; weekday: number; startMinute: number; endMinute: number; room: string }>) {
    const res = await api.patch<{ data: { entry: unknown } }>(`/timetable/${entryId}`, input);
    return res.data.data.entry;
  },
  async deleteEntry(entryId: string) {
    await api.delete(`/timetable/${entryId}`);
  },
  async createOverride(input: { entryId: string | null; date: string; action: 'cancel' | 'reschedule' | 'add'; newStartAt?: string; newEndAt?: string; newCourseId?: string; newFacultyId?: string; newRoom?: string }) {
    const res = await api.post<{ data: { override: unknown } }>('/timetable/overrides', input);
    return res.data.data.override;
  },
};

export const holidaysApiAdmin = {
  async create(input: { date: string; name: string }) {
    const res = await api.post<{ data: { holiday: HolidayDto } }>('/holidays', input);
    return res.data.data.holiday;
  },
  async delete(id: string) {
    await api.delete(`/holidays/${id}`);
  },
};

export const auditLogApi = {
  async list(params: { actorId?: string; action?: string; from?: string; to?: string; limit?: number } = {}) {
    const res = await api.get<{ data: { items: unknown[] } }>('/audit-logs', { params });
    return res.data.data.items;
  },
};

export interface CurriculumImportPreview {
  workflowId: string;
  workflowVersion: string;
  workflowStatus: string;
  course: { name: string; slug: string; summary: string };
  counts: {
    plos: number;
    modules: number;
    sessions: number;
    materials: number;
    assignments: number;
  };
  warnings: string[];
  alreadyImported: boolean;
  existingCourseId: string | null;
  existingLastSyncedAt: string | null;
  existingIsPartial: boolean;
}

export interface CurriculumImportResult {
  workflowId: string;
  courseId: string;
  created: {
    course: boolean;
    modules: number;
    sessions: number;
    materials: number;
    assignments: number;
  };
  warnings: string[];
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type SessionStatusValue = 'upcoming' | 'in_progress' | 'completed';

export interface SessionDto {
  id: string;
  moduleId: string;
  courseId: string;
  number: number;
  orderIndex: number;
  title: string;
  description: string;
  type: 'lecture' | 'seminar' | 'workshop' | 'tutorial' | 'lab' | 'assessment' | 'exam' | null;
  plannedMinutes: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  location: string | null;
  status: SessionStatusValue;
  completedAt: string | null;
  completedBy: string | null;
  completionUndoableUntil: string | null;
  notes: string;
  sourceLessonId: string | null;
  linkedMLOs: string[];
  bloomLevel: string | null;
  objectives: string[];
  activities: Array<{
    activityId: string;
    sequenceOrder: number;
    type: string;
    title: string;
    description: string;
    durationMinutes: number;
    teachingMethod: string;
    instructorActions: string[];
    studentActions: string[];
    resources: string[];
  }>;
  formativeChecks: Array<{
    checkId: string;
    type: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    linkedMLO: string | null;
    durationMinutes: number;
  }>;
  isAutoGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetailDto {
  session: SessionDto;
  materials: Array<{
    id: string;
    type: string;
    title: string;
    url: string | null;
    sizeBytes: number | null;
    slideCount: number | null;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    dueAt: string;
    maxScore: number;
    deliveryVariant: string | null;
  }>;
  attendanceSummary: {
    recorded: number;
    enrolled: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
}

export interface AttendanceRecordDto {
  id: string;
  sessionId: string;
  courseId: string;
  studentId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type MaterialType =
  | 'slides'
  | 'reading'
  | 'pdf'
  | 'video'
  | 'link'
  | 'practice'
  | 'reflection'
  | 'file'
  | 'case';

export interface MaterialDetailDto {
  id: string;
  courseId: string;
  sessionId: string | null;
  assignmentId: string | null;
  moduleId: string | null;
  type: MaterialType;
  title: string;
  body: unknown;
  url: string | null;
  sizeBytes: number | null;
  expectedHours: number | null;
  sourceDeckId: string | null;
  sourceLessonId: string | null;
  slideCount: number | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AddableMaterialType = Exclude<MaterialType, 'slides'>;

export const materialsApi = {
  async get(id: string) {
    const res = await api.get<{ data: { material: MaterialDetailDto } }>(`/materials/${id}`);
    return res.data.data.material;
  },
  async createOnSession(
    sessionId: string,
    input: {
      type: AddableMaterialType;
      title: string;
      url?: string | null;
      body?: string | null;
      sizeBytes?: number | null;
      expectedHours?: number | null;
    },
  ) {
    const res = await api.post<{ data: { material: MaterialDetailDto } }>(
      `/sessions/${sessionId}/materials`,
      input,
    );
    return res.data.data.material;
  },
  async delete(id: string) {
    await api.delete(`/materials/${id}`);
  },
  /**
   * Replace the JSON slide body for a `type=slides` material. Faculty
   * can use this to upload an edited deck (downloaded → tweaked →
   * re-uploaded) without going through the curriculum-import flow.
   */
  async replaceSlides(id: string, body: unknown) {
    const res = await api.put<{ data: { material: MaterialDetailDto } }>(
      `/materials/${id}/slides`,
      body,
    );
    return res.data.data.material;
  },
};

export const sessionsApi = {
  async listForCourse(courseId: string) {
    const res = await api.get<{ data: { sessions: SessionDto[] } }>(
      `/courses/${courseId}/sessions`,
    );
    return res.data.data.sessions;
  },
  async detail(sessionId: string) {
    const res = await api.get<{ data: SessionDetailDto }>(`/sessions/${sessionId}`);
    return res.data.data;
  },
  async update(
    sessionId: string,
    input: Partial<{
      title: string;
      description: string;
      type: NonNullable<SessionDto['type']>;
      plannedMinutes: number | null;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      location: string | null;
      notes: string;
      moduleId: string;
      orderIndex: number;
    }>,
  ) {
    const res = await api.patch<{ data: { session: SessionDto } }>(
      `/sessions/${sessionId}`,
      input,
    );
    return res.data.data.session;
  },
  async complete(sessionId: string) {
    const res = await api.post<{ data: { session: SessionDto } }>(
      `/sessions/${sessionId}/complete`,
      {},
    );
    return res.data.data.session;
  },
  async uncomplete(sessionId: string) {
    const res = await api.post<{ data: { session: SessionDto } }>(
      `/sessions/${sessionId}/uncomplete`,
      {},
    );
    return res.data.data.session;
  },
  async listAttendance(sessionId: string) {
    const res = await api.get<{ data: { records: AttendanceRecordDto[] } }>(
      `/sessions/${sessionId}/attendance`,
    );
    return res.data.data.records;
  },
  async recordAttendance(
    sessionId: string,
    records: Array<{ studentId: string; status: AttendanceStatus }>,
  ) {
    const res = await api.post<{
      data: { records: AttendanceRecordDto[]; skipped: string[] };
    }>(`/sessions/${sessionId}/attendance`, { records });
    return res.data.data;
  },
};

export const curriculumImportApi = {
  async health() {
    const res = await api.get<{ data: { ok: boolean; baseUrl: string } }>(
      '/curriculum-import/health',
    );
    return res.data.data;
  },
  async preview(workflowId: string) {
    const res = await api.get<{ data: CurriculumImportPreview }>(
      '/curriculum-import/preview',
      { params: { workflowId } },
    );
    return res.data.data;
  },
  async run(input: { workflowId: string; programId: string; replace?: boolean }) {
    const res = await api.post<{ data: CurriculumImportResult }>(
      '/curriculum-import',
      input,
    );
    return res.data.data;
  },
};

export const adminEnrollmentsApi = {
  async list(params: { batchId?: string; studentId?: string; status?: string } = {}) {
    // Server returns { items, total, page, limit }; the legacy client
    // here read `enrolments` and crashed with
    // "['admin','enrollments'] data is undefined" (UAT round 4).
    const res = await api.get<{
      data: { items: EnrollmentDto[]; total: number; page: number; limit: number };
    }>('/enrollments', { params });
    return res.data.data.items;
  },
  async create(input: { studentId: string; batchId: string }) {
    const res = await api.post<{ data: { enrolments: EnrollmentDto[] } }>('/enrollments', input);
    return res.data.data.enrolments;
  },
  async generateFees(id: string) {
    const res = await api.post<{ data: { invoices: InvoiceDto[] } }>(`/enrollments/${id}/generate-fees`, {});
    return res.data.data.invoices;
  },
  // M10x — PATCH for declaredTotalPaise + other fields. Returns the
  // updated EnrollmentDto.
  async update(
    id: string,
    patch: {
      declaredTotalPaise?: number | null;
      batchId?: string;
      validTo?: string;
      completed?: boolean;
      status?: 'revoked';
      accessState?: 'active' | 'warn1' | 'warn2' | 'override' | 'suspended';
    },
  ) {
    const res = await api.patch<{ data: { enrolment: EnrollmentDto } }>(
      `/enrollments/${id}`,
      patch,
    );
    return res.data.data.enrolment;
  },
};

export const facultyApi = {
  async myCourses() {
    const res = await api.get<{ data: { items: CourseDto[] } }>('/courses', { params: { mine: 'true' } });
    return res.data.data.items;
  },
  async myTimetable(params: { week?: string } = {}) {
    const res = await api.get<{
      data: { window: { from: string; to: string }; occurrences: TimetableOccurrenceDto[] };
    }>('/me/timetable', { params });
    return res.data.data.occurrences;
  },
  async gradingQueue() {
    const res = await api.get<{ data: { items: ExamAttemptDto[] } }>('/staff/grading-queue');
    return res.data.data.items;
  },
  async examAttempt(attemptId: string) {
    const res = await api.get<{ data: { attempt: ExamAttemptDto } }>(`/exam-attempts/${attemptId}`);
    return res.data.data.attempt;
  },
  async listFeedback() {
    const res = await api.get<{ data: { feedback: FeedbackEntryDto[] } }>('/feedback', { params: { mine: 'true' } });
    return res.data.data.feedback;
  },
  async listRubrics() {
    const res = await api.get<{ data: { rubrics: unknown[] } }>('/rubrics');
    return res.data.data.rubrics;
  },
};

export const outstandingFeesType = {} as OutstandingFeesDto; // silence unused type export

export const quizzesApi = {
  async get(id: string) {
    const res = await api.get<{ data: { quiz: QuizDto } }>(`/quizzes/${id}`);
    return res.data.data.quiz;
  },
  async startAttempt(id: string) {
    const res = await api.post<{ data: { attempt: QuizAttemptDto } }>(`/quizzes/${id}/attempt`, {});
    return res.data.data.attempt;
  },
  async submitAttempt(attemptId: string, answers: { questionIndex: number; chosenIndices: number[] }[]) {
    const res = await api.post<{ data: { attempt: QuizAttemptDto } }>(
      `/quiz-attempts/${attemptId}/submit`,
      { answers },
    );
    return res.data.data.attempt;
  },
};

export const examsApi = {
  async get(id: string) {
    const res = await api.get<{ data: { exam: ExamDto } }>(`/exams/${id}`);
    return res.data.data.exam;
  },
  async startAttempt(id: string) {
    const res = await api.post<{ data: { attempt: ExamAttemptDto } }>(`/exams/${id}/attempt`, {});
    return res.data.data.attempt;
  },
  async submitAttempt(
    attemptId: string,
    body: {
      answers?: { questionIndex: number; chosenIndices: number[] }[];
      essayAnswers?: { questionIndex: number; text: string }[];
    },
  ) {
    const res = await api.post<{ data: { attempt: ExamAttemptDto } }>(
      `/exam-attempts/${attemptId}/submit`,
      body,
    );
    return res.data.data.attempt;
  },
  async grade(attemptId: string, grades: { questionIndex: number; score: number; comment?: string }[]) {
    const res = await api.post<{ data: { attempt: ExamAttemptDto } }>(
      `/exam-attempts/${attemptId}/grade`,
      { grades },
    );
    return res.data.data.attempt;
  },
};

export const feedbackApi = {
  async listMine() {
    const res = await api.get<{ data: { feedback: FeedbackEntryDto[] } }>('/me/feedback');
    return res.data.data.feedback;
  },
  async create(input: unknown) {
    const res = await api.post<{ data: { feedback: FeedbackEntryDto } }>('/feedback', input);
    return res.data.data.feedback;
  },
  async publish(id: string) {
    const res = await api.patch<{ data: { feedback: FeedbackEntryDto } }>(`/feedback/${id}`, {
      status: 'published',
    });
    return res.data.data.feedback;
  },
};

// M1-M5 — Admissions module endpoints. The signup, programs, cohorts, and
// referee-upload endpoints are the only public (unauthenticated) ones; the
// rest assume the applicant or officer is signed in.
export const admissionsApi = {
  async signup(input: ApplicantSignupInput): Promise<{
    application: ApplicationDto;
    accessToken: string;
    accessTokenExpiresIn: number;
  }> {
    const res = await api.post<{
      data: {
        application: ApplicationDto;
        accessToken: string;
        accessTokenExpiresIn: number;
      };
    }>('/admissions/apply/signup', { ...input, deviceId: getDeviceId() });
    return res.data.data;
  },
  async myApplication(): Promise<ApplicationDto> {
    const res = await api.get<{ data: { application: ApplicationDto } }>(
      '/admissions/me/application',
    );
    return res.data.data.application;
  },
  async listPublicPrograms(): Promise<PublicProgramDto[]> {
    const res = await api.get<{ data: { items: PublicProgramDto[] } }>(
      '/admissions/apply/programs',
    );
    return res.data.data.items;
  },
  async listPublicCohorts(programId: string): Promise<PublicCohortDto[]> {
    const res = await api.get<{ data: { items: PublicCohortDto[] } }>(
      `/admissions/apply/programs/${programId}/cohorts`,
    );
    return res.data.data.items;
  },
  async getDraft(): Promise<ApplicationDraftDto> {
    const res = await api.get<{ data: { draft: ApplicationDraftDto } }>(
      '/admissions/me/draft',
    );
    return res.data.data.draft;
  },
  async saveDraft(input: SaveDraftInput): Promise<ApplicationDraftDto> {
    const res = await api.put<{ data: { draft: ApplicationDraftDto } }>(
      '/admissions/me/draft',
      input,
    );
    return res.data.data.draft;
  },
  async signDocumentUpload(
    input: SignDocumentUploadInput,
  ): Promise<SignedUploadTicketDto> {
    const res = await api.post<{ data: { ticket: SignedUploadTicketDto } }>(
      '/admissions/me/documents/sign-upload',
      input,
    );
    return res.data.data.ticket;
  },
  async registerDocument(
    input: RegisterDocumentInput,
  ): Promise<ApplicationDocumentDto> {
    const res = await api.post<{ data: { document: ApplicationDocumentDto } }>(
      '/admissions/me/documents',
      input,
    );
    return res.data.data.document;
  },
  async listMyDocuments(): Promise<ApplicationDocumentDto[]> {
    const res = await api.get<{ data: { items: ApplicationDocumentDto[] } }>(
      '/admissions/me/documents',
    );
    return res.data.data.items;
  },
  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/admissions/me/documents/${id}`);
  },
  async saveStatement(input: SaveStatementInput): Promise<{ statement: string }> {
    const res = await api.put<{ data: { statement: string } }>(
      '/admissions/me/statement',
      input,
    );
    return res.data.data;
  },
  async getStatement(): Promise<{ statement: string }> {
    const res = await api.get<{ data: { statement: string } }>(
      '/admissions/me/statement',
    );
    return res.data.data;
  },
  async listMyReferees(): Promise<RefereeDto[]> {
    const res = await api.get<{ data: { items: RefereeDto[] } }>(
      '/admissions/me/referees',
    );
    return res.data.data.items;
  },
  async addReferee(input: AddRefereeInput): Promise<RefereeDto> {
    const res = await api.post<{ data: { referee: RefereeDto } }>(
      '/admissions/me/referees',
      input,
    );
    return res.data.data.referee;
  },
  async resendReferee(id: string): Promise<RefereeDto> {
    const res = await api.post<{ data: { referee: RefereeDto } }>(
      `/admissions/me/referees/${id}/resend`,
      {},
    );
    return res.data.data.referee;
  },
  async deleteReferee(id: string): Promise<void> {
    await api.delete(`/admissions/me/referees/${id}`);
  },
  // M3b — Public referee upload (no auth, uses tokenized URL).
  async getRefereeContext(token: string): Promise<RefereeUploadContextDto> {
    const res = await api.get<{ data: { context: RefereeUploadContextDto } }>(
      `/admissions/referee/${encodeURIComponent(token)}`,
    );
    return res.data.data.context;
  },
  async refereeUpload(
    token: string,
    input: { url: string; key: string; sizeBytes: number; mimeType: string },
  ): Promise<{ ok: true }> {
    const res = await api.post<{ data: { ok: true } }>(
      `/admissions/referee/${encodeURIComponent(token)}/upload`,
      input,
    );
    return res.data.data;
  },
  async refereeSignUpload(
    token: string,
    input: { mimeType: string; sizeBytes: number },
  ): Promise<SignedUploadTicketDto> {
    const res = await api.post<{ data: { ticket: SignedUploadTicketDto } }>(
      `/admissions/referee/${encodeURIComponent(token)}/sign-upload`,
      input,
    );
    return res.data.data.ticket;
  },
  // M4 — Submit / withdraw.
  async submitApplication(input: SubmitApplicationInput): Promise<ApplicationDto> {
    const res = await api.post<{ data: { application: ApplicationDto } }>(
      '/admissions/me/application/submit',
      input,
    );
    return res.data.data.application;
  },
  async withdrawApplication(
    input: WithdrawApplicationInput,
  ): Promise<ApplicationDto> {
    const res = await api.post<{ data: { application: ApplicationDto } }>(
      '/admissions/me/application/withdraw',
      input,
    );
    return res.data.data.application;
  },
  // M5 — Officer side.
  async listForOfficer(
    params: {
      state?: ApplicationState;
      programId?: string;
      q?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    items: ApplicationDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const res = await api.get<{
      data: {
        items: ApplicationDto[];
        total: number;
        page: number;
        limit: number;
      };
    }>('/admissions/officer/applications', { params });
    return res.data.data;
  },
  async getForOfficer(id: string): Promise<OfficerApplicationDetailDto> {
    const res = await api.get<{
      data: { application: OfficerApplicationDetailDto };
    }>(`/admissions/officer/applications/${id}`);
    return res.data.data.application;
  },
  async addOfficerNote(
    id: string,
    input: AddReviewerNoteInput,
  ): Promise<ReviewerNoteDto> {
    const res = await api.post<{ data: { note: ReviewerNoteDto } }>(
      `/admissions/officer/applications/${id}/notes`,
      input,
    );
    return res.data.data.note;
  },
  async recordDecision(
    id: string,
    input: ApplicationDecisionInput,
  ): Promise<ApplicationDto> {
    const res = await api.post<{ data: { application: ApplicationDto } }>(
      `/admissions/officer/applications/${id}/decision`,
      input,
    );
    return res.data.data.application;
  },
  async getAuditChain(id: string): Promise<AdmissionsAuditChainDto> {
    const res = await api.get<{ data: AdmissionsAuditChainDto }>(
      `/admissions/officer/applications/${id}/audit`,
    );
    return res.data.data;
  },
  // M6 — application fee.
  async getMyFee(): Promise<ApplicationFeeDto | null> {
    const res = await api.get<{ data: { fee: ApplicationFeeDto | null } }>(
      '/admissions/me/fee',
    );
    return res.data.data.fee;
  },
  async recordApplicationPayment(
    applicationId: string,
    input: RecordApplicationPaymentInput,
  ): Promise<{ fee: ApplicationFeeDto; payment: ApplicationPaymentDto }> {
    const res = await api.post<{
      data: { fee: ApplicationFeeDto; payment: ApplicationPaymentDto };
    }>(`/admissions/finance/applications/${applicationId}/payment`, input);
    return res.data.data;
  },
  async waiveApplicationFee(
    applicationId: string,
    input: WaiveApplicationFeeInput,
  ): Promise<ApplicationFeeDto> {
    const res = await api.post<{ data: { fee: ApplicationFeeDto } }>(
      `/admissions/officer/applications/${applicationId}/fee/waive`,
      input,
    );
    return res.data.data.fee;
  },
  // M7 — accept / decline.
  async acceptOffer(): Promise<AcceptOfferResult> {
    const res = await api.post<{ data: AcceptOfferResult }>(
      '/admissions/me/application/accept',
      {},
    );
    return res.data.data;
  },
  async declineOffer(reason?: string): Promise<ApplicationDto> {
    const res = await api.post<{ data: { application: ApplicationDto } }>(
      '/admissions/me/application/decline',
      reason ? { reason } : {},
    );
    return res.data.data.application;
  },
  async assignCohort(applicationId: string, input: AssignCohortInput): Promise<ApplicationDto> {
    const res = await api.post<{ data: { application: ApplicationDto } }>(
      `/admissions/officer/applications/${applicationId}/assign-cohort`,
      input,
    );
    return res.data.data.application;
  },
  // M8 — funnel analytics.
  async getAnalytics(): Promise<AdmissionsAnalyticsDto> {
    const res = await api.get<{ data: AdmissionsAnalyticsDto }>(
      '/admissions/officer/analytics',
    );
    return res.data.data;
  },
};

export const analyticsApi = {
  async summary(params?: { programId?: string; from?: string; to?: string }) {
    const res = await api.get<{ data: AnalyticsSummaryDto }>('/analytics/summary', {
      params,
    });
    return res.data.data;
  },
  async collections(from: string, to: string) {
    const res = await api.get<{ data: CollectionsReportDto }>('/analytics/collections', {
      params: { from, to },
    });
    return res.data.data;
  },
};

// M10f — Placement / Jobs (LMS_Requirements §3).
export const placementApi = {
  async listCompanies(): Promise<CompanyDto[]> {
    const res = await api.get<{ data: { items: CompanyDto[] } }>('/companies');
    return res.data.data.items;
  },
  async createCompany(input: CreateCompanyInput) {
    const res = await api.post<{ data: { company: CompanyDto } }>('/companies', input);
    return res.data.data.company;
  },
  async updateCompany(id: string, patch: UpdateCompanyInput) {
    const res = await api.patch<{ data: { company: CompanyDto } }>(`/companies/${id}`, patch);
    return res.data.data.company;
  },
  async deleteCompany(id: string) {
    await api.delete(`/companies/${id}`);
  },
  async listJobs(params: { state?: string; companyId?: string } = {}): Promise<JobPostingDto[]> {
    const res = await api.get<{ data: { items: JobPostingDto[] } }>('/jobs', { params });
    return res.data.data.items;
  },
  async getJob(id: string): Promise<JobPostingDto> {
    const res = await api.get<{ data: { posting: JobPostingDto } }>(`/jobs/${id}`);
    return res.data.data.posting;
  },
  async createJob(input: CreateJobPostingInput) {
    const res = await api.post<{ data: { posting: JobPostingDto } }>('/jobs', input);
    return res.data.data.posting;
  },
  async updateJob(id: string, patch: UpdateJobPostingInput) {
    const res = await api.patch<{ data: { posting: JobPostingDto } }>(`/jobs/${id}`, patch);
    return res.data.data.posting;
  },
  async deleteJob(id: string) {
    await api.delete(`/jobs/${id}`);
  },
  async applyToJob(jobId: string, input: ApplyToJobInput) {
    const res = await api.post<{ data: { application: JobApplicationDto } }>(`/jobs/${jobId}/apply`, input);
    return res.data.data.application;
  },
  async listApplicationsForJob(jobId: string): Promise<JobApplicationDto[]> {
    const res = await api.get<{ data: { items: JobApplicationDto[] } }>(`/jobs/${jobId}/applications`);
    return res.data.data.items;
  },
  async listMyApplications(): Promise<JobApplicationDto[]> {
    const res = await api.get<{ data: { items: JobApplicationDto[] } }>('/me/job-applications');
    return res.data.data.items;
  },
  async withdrawApplication(applicationId: string) {
    await api.delete(`/me/job-applications/${applicationId}`);
  },
  async updateApplicationStatus(
    applicationId: string,
    patch: UpdateJobApplicationInput,
  ) {
    const res = await api.patch<{ data: { application: JobApplicationDto } }>(`/job-applications/${applicationId}`, patch);
    return res.data.data.application;
  },
  async analytics(): Promise<PlacementAnalyticsDto> {
    const res = await api.get<{ data: PlacementAnalyticsDto }>('/placement/analytics');
    return res.data.data;
  },
};

// M10e — Internal chat (LMS_Requirements §2). PR-E1: 1:1 direct
// conversations with 5s polling for new messages.
export const chatApi = {
  async listMyConversations(): Promise<ConversationDto[]> {
    const res = await api.get<{ data: { items: ConversationDto[] } }>('/me/conversations');
    return res.data.data.items;
  },
  async getOrCreateDirect(otherUserId: string): Promise<ConversationDto> {
    const res = await api.post<{ data: { conversation: ConversationDto } }>(
      '/chat/conversations/direct',
      { otherUserId },
    );
    return res.data.data.conversation;
  },
  async listMessages(conversationId: string, since?: string): Promise<ChatMessageDto[]> {
    const res = await api.get<{ data: { items: ChatMessageDto[] } }>(
      `/chat/conversations/${conversationId}/messages`,
      { params: since ? { since } : {} },
    );
    return res.data.data.items;
  },
  async sendMessage(conversationId: string, input: SendChatMessageInput): Promise<ChatMessageDto> {
    const res = await api.post<{ data: { message: ChatMessageDto } }>(
      `/chat/conversations/${conversationId}/messages`,
      input,
    );
    return res.data.data.message;
  },
  async markRead(conversationId: string): Promise<void> {
    await api.post(`/chat/conversations/${conversationId}/read`, {});
  },
  async searchUsers(q: string): Promise<Array<{ id: string; name: string; role: string; email: string; code: string | null }>> {
    const res = await api.get<{ data: { items: Array<{ id: string; name: string; role: string; email: string; code: string | null }> } }>(
      '/chat/search-users',
      { params: { q } },
    );
    return res.data.data.items;
  },
};

// M10s — Visitor Leads (admin-captured prospect funnel).
export const visitorLeadsApi = {
  async list(params: {
    q?: string;
    status?: VisitorLeadStatus;
    leadSource?: VisitorLeadSource;
    otpStatus?: VisitorOtpStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: VisitorLeadDto[]; total: number; page: number; limit: number }> {
    const res = await api.get<{
      data: { items: VisitorLeadDto[]; total: number; page: number; limit: number };
    }>('/visitor-leads', { params });
    return res.data.data;
  },
  async get(id: string): Promise<VisitorLeadDto> {
    const res = await api.get<{ data: { lead: VisitorLeadDto } }>(`/visitor-leads/${id}`);
    return res.data.data.lead;
  },
  async create(input: CreateVisitorLeadInput): Promise<VisitorLeadDto> {
    const res = await api.post<{ data: { lead: VisitorLeadDto } }>('/visitor-leads', input);
    return res.data.data.lead;
  },
  async update(id: string, patch: UpdateVisitorLeadInput): Promise<VisitorLeadDto> {
    const res = await api.patch<{ data: { lead: VisitorLeadDto } }>(`/visitor-leads/${id}`, patch);
    return res.data.data.lead;
  },
  async remove(id: string): Promise<VisitorLeadDto> {
    const res = await api.delete<{ data: { lead: VisitorLeadDto } }>(`/visitor-leads/${id}`);
    return res.data.data.lead;
  },
};

// M10s — Manual installment editing on top of auto-gen.
export const installmentsApi = {
  async create(input: {
    invoiceId: string;
    label: string;
    amountPaise: number;
    dueDate: string;
    // M10x — Milestone label (e.g., "Seat Reservation") that displays
    // instead of the calendar date when set.
    dueLabel?: string | null;
    status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
  }): Promise<{ installment: Record<string, unknown>; invoice: Record<string, unknown> }> {
    const res = await api.post<{
      data: { installment: Record<string, unknown>; invoice: Record<string, unknown> };
    }>('/installments', input);
    return res.data.data;
  },
  async update(
    id: string,
    patch: {
      label?: string;
      amountPaise?: number;
      dueDate?: string;
      dueLabel?: string | null;
      status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
    },
  ): Promise<{ installment: Record<string, unknown>; invoice: Record<string, unknown> }> {
    const res = await api.patch<{
      data: { installment: Record<string, unknown>; invoice: Record<string, unknown> };
    }>(`/installments/${id}`, patch);
    return res.data.data;
  },
  async waive(id: string): Promise<{ installment: Record<string, unknown>; invoice: Record<string, unknown> }> {
    const res = await api.post<{
      data: { installment: Record<string, unknown>; invoice: Record<string, unknown> };
    }>(`/installments/${id}/waive`, {});
    return res.data.data;
  },
};

// M10u — Staff attendance (faculty self-mark + admin override).
export const staffAttendanceApi = {
  async mark(input: MarkStaffAttendanceInput): Promise<StaffAttendanceDto> {
    const res = await api.post<{ data: { attendance: StaffAttendanceDto } }>(
      '/staff-attendance',
      input,
    );
    return res.data.data.attendance;
  },
  async meToday(): Promise<StaffAttendanceDto | null> {
    const res = await api.get<{ data: { attendance: StaffAttendanceDto | null } }>(
      '/staff-attendance/me/today',
    );
    return res.data.data.attendance;
  },
  async list(params: {
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: StaffAttendanceStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    items: StaffAttendanceDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const res = await api.get<{
      data: { items: StaffAttendanceDto[]; total: number; page: number; limit: number };
    }>('/staff-attendance', { params });
    return res.data.data;
  },
};

// M10q — Generic file uploads through the configured storage adapter
// (GridFS-backed in default production config). Returns the public URL the
// browser can render + the opaque storage key the backend uses for deletes.
export interface UploadFileResult {
  url: string;
  key: string;
}
export const filesApi = {
  async upload(file: File, folder: string): Promise<UploadFileResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<{ data: UploadFileResult }>(
      '/files/upload',
      form,
      { params: { folder }, headers: { 'content-type': 'multipart/form-data' } },
    );
    return res.data.data;
  },
};
