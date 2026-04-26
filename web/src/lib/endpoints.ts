import type {
  AnalyticsSummaryDto,
  CertificateDto,
  CollectionsReportDto,
  CourseDto,
  CreateTicketInput,
  EnrollmentDto,
  ExamAttemptDto,
  ExamDto,
  FeedbackEntryDto,
  HolidayDto,
  InvoiceDto,
  ModuleDto,
  NotificationDto,
  NotificationPrefsDto,
  OutstandingFeesDto,
  PaymentDto,
  ProgramDto,
  QuizAttemptDto,
  QuizDto,
  ReceiptDto,
  StudentDashboardDto,
  StudentFeesDto,
  TicketCommentDto,
  TicketDto,
  TicketState,
  TimetableOccurrenceDto,
  UserPublicDto,
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
  }) {
    const res = await api.post<{ data: { user: UserPublicDto } }>('/users', input);
    return res.data.data.user;
  },
  async update(id: string, input: Partial<{ name: string; email: string; phoneE164: string; address: string | null; programId: string; batchId: string }>) {
    const res = await api.patch<{ data: { user: UserPublicDto } }>(`/users/${id}`, input);
    return res.data.data.user;
  },
  async updateMe(input: { name?: string; phoneE164?: string; address?: string | null }) {
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
  async create(input: { name: string; slug: string; description?: string; totalHours?: number }) {
    const res = await api.post<{ data: { program: ProgramDto } }>('/programs', input);
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

export const meCoursesApi = {
  async list() {
    const res = await api.get<{ data: { enrolments: EnrollmentDto[] } }>('/me/courses');
    return res.data.data.enrolments;
  },
  async get(courseId: string) {
    const res = await api.get<{ data: { course: CourseDto; modules: ModuleDto[] } }>(`/me/courses/${courseId}`);
    return res.data.data;
  },
};

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
  async update(id: string, input: Partial<{ name: string; capacity: number; startDate: string; endDate: string; status: string }>) {
    const res = await api.patch<{ data: { batch: unknown } }>(`/batches/${id}`, input);
    return res.data.data.batch;
  },
  async timetable(id: string) {
    const res = await api.get<{ data: { items: unknown[] } }>(`/batches/${id}/timetable`);
    return res.data.data.items;
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
    const res = await api.get<{ data: { enrolments: EnrollmentDto[] } }>('/enrollments', { params });
    return res.data.data.enrolments;
  },
  async create(input: { studentId: string; batchId: string }) {
    const res = await api.post<{ data: { enrolments: EnrollmentDto[] } }>('/enrollments', input);
    return res.data.data.enrolments;
  },
  async generateFees(id: string) {
    const res = await api.post<{ data: { invoices: InvoiceDto[] } }>(`/enrollments/${id}/generate-fees`, {});
    return res.data.data.invoices;
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
