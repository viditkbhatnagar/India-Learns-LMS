import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role } from 'india-learns-shared-types';
import { RequireAuth, RequireRole, defaultRouteForRole } from './components/guards.js';
import { useAuthStore } from './store/auth.js';
import { ErrorBoundary } from './components/ui/States.js';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage.js';
import { VisitorRegisterPage } from './pages/VisitorRegisterPage.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.js';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage.js';

// Onboarding (M9)
import {
  OnbArrivalPage,
  OnbEmailInvitePage,
  OnbLandingPage,
  OnbSetPasswordPage,
  OnbTourPage,
} from './pages/onboarding/Onboarding.js';

// Student
import { StudentDashboard } from './pages/student/StudentDashboard.js';
import {
  StudentCourses,
  StudentModuleView,
} from './pages/student/StudentCourses.js';
import { StudentCoursePage } from './pages/student/course-view/StudentCoursePage.js';
import { StudentSessionPage } from './pages/student/course-view/StudentSessionPage.js';
import { StudentTimetable } from './pages/student/StudentTimetable.js';
import { StudentFees } from './pages/student/StudentFees.js';
import {
  StudentTickets,
  NewTicketPage,
  StudentTicketDetail,
} from './pages/student/StudentTickets.js';
import { StudentFeedback } from './pages/student/StudentFeedback.js';
import { StudentCertificates } from './pages/student/StudentCertificates.js';
import { QuizAttemptPage } from './pages/student/QuizAttempt.js';
import { ExamAttemptPage } from './pages/student/ExamAttempt.js';

// Entrance Exam — isolated temporary-candidate module (standalone routes).
import { EntranceLoginPage } from './pages/entrance/EntranceLogin.js';
import { EntranceExamPage } from './pages/entrance/EntranceExam.js';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard.js';
import {
  AdminUsers,
  AdminInviteUser,
  AdminUserDetail,
} from './pages/admin/AdminUsers.js';
import { AdminFacultyPage } from './pages/admin/AdminFaculty.js';
import { AdminTickets } from './pages/admin/AdminTickets.js';
import { AdminPrograms, AdminCourses } from './pages/admin/AdminPrograms.js';
import { AdminProgramAdmissionsPage } from './pages/admin/AdminProgramAdmissions.js';
import { AdminBatchesPage } from './pages/admin/AdminBatches.js';
import { AdminBatchDetailPage } from './pages/admin/AdminBatchDetail.js';
import { AdminTimetableBuilderPage } from './pages/admin/AdminTimetableBuilder.js';
import { AdminEnrollmentsPage } from './pages/admin/AdminEnrollments.js';
import { AdminEnrollmentDetailPage } from './pages/admin/AdminEnrollmentDetail.js';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogs.js';
import { AdminCurriculumImport } from './pages/admin/AdminCurriculumImport.js';
// CourseGradebookPage + AssignmentGradingPage no longer mounted at the
// top level — the B-2 course shell renders both via inner Routes.
import { CourseShell } from './pages/staff/CourseShell.js';
import { AdminFeeStructuresPage } from './pages/admin/AdminFeeStructures.js';
import { AdminTicketDetailPage } from './pages/admin/AdminTicketDetail.js';
import { AdminSlaBreachesPage } from './pages/admin/AdminSlaBreaches.js';
import { AdminHolidaysPage } from './pages/admin/AdminHolidays.js';
import { AdminVisitorLeadsPage } from './pages/admin/AdminVisitorLeads.js';
import { AdminStaffAttendancePage } from './pages/admin/AdminStaffAttendance.js';
import { AdminEntranceExamPage } from './pages/admin/AdminEntranceExam.js';
import { AdminEntranceAttemptPage } from './pages/admin/AdminEntranceAttempt.js';

// Finance
import { FinanceDashboard } from './pages/finance/FinanceDashboard.js';
import { FinancePaymentNew } from './pages/finance/FinancePayment.js';
import { FinanceStudentsPage } from './pages/finance/FinanceStudents.js';
import { FinanceStudentDetailPage } from './pages/finance/FinanceStudentDetail.js';
import { FinancePaymentsListPage } from './pages/finance/FinancePaymentsList.js';
import { FinancePaymentDetailPage } from './pages/finance/FinancePaymentDetail.js';
import { FinanceReportsPage } from './pages/finance/FinanceReports.js';
import { ReportsPage } from './pages/Reports.js';
import { ShowcasePage } from './pages/staff/Showcase.js';
import { AdminPlacementPage } from './pages/AdminPlacement.js';
import { StudentJobsPage } from './pages/StudentJobs.js';
import { ChatPage } from './pages/Chat.js';
import { AnnouncementsPage } from './pages/Announcements.js';

// Faculty
import { FacultyDashboard } from './pages/faculty/FacultyDashboard.js';
import { FacultyCoursesPage } from './pages/faculty/FacultyCourses.js';
import { FacultyCourseDetailPage } from './pages/faculty/FacultyCourseDetail.js';
import { FacultyGradingQueuePage } from './pages/faculty/FacultyGrading.js';
import { FacultyGradingDetailPage } from './pages/faculty/FacultyGradingDetail.js';
import { FacultyFeedbackPage } from './pages/faculty/FacultyFeedback.js';
import { FacultyFeedbackNewPage } from './pages/faculty/FacultyFeedbackNew.js';
import { FacultyTimetablePage } from './pages/faculty/FacultyTimetable.js';
import { BatchAttendancePage } from './pages/faculty/BatchAttendance.js';

// Shared
import { ProfilePage, NotificationPrefsPage } from './pages/ProfilePage.js';
import { OfflinePage } from './pages/Offline.js';

// Admissions (M1+)
import {
  ApplyLandingPage,
  ApplyPortalPage,
  ApplySignupPage,
} from './pages/apply/Apply.js';
import { ApplyFormPage } from './pages/apply/Form.js';
import {
  ApplyConfirmationPage,
  ApplyDocumentsPage,
  ApplyReferencesPage,
  ApplyStatementPage,
  ApplySubmitPage,
} from './pages/apply/Steps.js';
import { AdmissionsDashboardPage } from './pages/admissions/AdmissionsDashboard.js';
import { AdmissionsApplicationDetailPage } from './pages/admissions/AdmissionsApplicationDetail.js';
import { RefereeUploadPage } from './pages/refer/RefereeUpload.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LandingRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteForRole(user.role as Role)} replace />;
}

/** Bounce a legacy course URL into the new B-2 shell. */
function RedirectToCourseShell({
  tail,
  paramKey = 'id',
}: {
  tail: 'overview' | 'content' | 'gradebook';
  paramKey?: 'id' | 'courseId';
}) {
  const params = useParams<{ id?: string; courseId?: string }>();
  const courseId = params[paramKey] ?? params.id ?? params.courseId ?? '';
  if (!courseId) return <Navigate to="/" replace />;
  return <Navigate to={`/courses/${courseId}/${tail}`} replace />;
}

/** Bounce a legacy assignment-grading URL into the shell-scoped path. */
function RedirectAssignmentGrading({ paramKey = 'courseId' }: { paramKey?: 'courseId' | 'id' } = {}) {
  const params = useParams<{ id?: string; courseId?: string; assignmentId?: string }>();
  const courseId = params[paramKey] ?? params.courseId ?? params.id ?? '';
  const assignmentId = params.assignmentId ?? '';
  if (!courseId || !assignmentId) return <Navigate to="/" replace />;
  return <Navigate to={`/courses/${courseId}/assignments/${assignmentId}/grading`} replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/offline" element={<OfflinePage />} />
          {/* M10u — Public visitor self-registration. No auth, IP rate-limited. */}
          <Route path="/visitor-register" element={<VisitorRegisterPage />} />

          {/* Entrance Exam — temporary candidates. Standalone (no AppShell); the
              candidate token lives in its own sessionStorage store. */}
          <Route path="/entrance" element={<EntranceLoginPage />} />
          <Route path="/entrance/exam" element={<EntranceExamPage />} />

          {/* Admissions — public landing + signup + referee upload (no AppShell) */}
          <Route path="/apply" element={<ApplyLandingPage />} />
          <Route path="/apply/signup" element={<ApplySignupPage />} />
          <Route path="/refer/:token" element={<RefereeUploadPage />} />
          <Route
            path="/apply/portal"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyPortalPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/form"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyFormPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/documents"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyDocumentsPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/statement"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyStatementPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/references"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyReferencesPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/submit"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplySubmitPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/apply/confirmation"
            element={
              <RequireAuth>
                <RequireRole roles={['applicant']}>
                  <ApplyConfirmationPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Admissions Officer dashboard — staff-authenticated */}
          <Route
            path="/admissions/*"
            element={
              <RequireAuth>
                <RequireRole roles={['admissions_officer', 'admin', 'superadmin']}>
                  <Routes>
                    <Route path="dashboard" element={<AdmissionsDashboardPage />} />
                    <Route path="applications/:id" element={<AdmissionsApplicationDetailPage />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Onboarding flow — public, no AppShell */}
          <Route path="/onboarding/email-invite" element={<OnbEmailInvitePage />} />
          <Route path="/onboarding/landing" element={<OnbLandingPage />} />
          <Route path="/onboarding/set-password" element={<OnbSetPasswordPage />} />
          <Route path="/onboarding/tour" element={<OnbTourPage />} />
          <Route path="/onboarding/arrival" element={<OnbArrivalPage />} />

          {/* M10j — Announcements (LMS_Requirements §2). */}
          <Route
            path="/announcements"
            element={
              <RequireAuth>
                <AnnouncementsPage />
              </RequireAuth>
            }
          />

          {/* M10e — Chat (PR-E1 ships 1:1 polling; real-time + groups in PR-E2). */}
          <Route
            path="/chat"
            element={
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            }
          />

          {/* M10f — Placement / Jobs. Admin console + student feed. */}
          <Route
            path="/admin/placement"
            element={
              <RequireAuth>
                <RequireRole roles={['admin', 'superadmin', 'admissions_officer']}>
                  <AdminPlacementPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/jobs"
            element={
              <RequireAuth>
                <RequireRole roles={['student']}>
                  <StudentJobsPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* M10 — Reports module. Admin, faculty + admissions officer can
              hit it; faculty are further scoped server-side to batches they
              teach. (M10r: finance role removed; admin owns finance reports.) */}
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <RequireRole roles={['admin', 'superadmin', 'faculty', 'admissions_officer']}>
                  <ReportsPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Showcase — staff-only marketing collateral (company profile +
              program brochures) presented in-app. Admin/Superadmin + Faculty. */}
          <Route
            path="/showcase"
            element={
              <RequireAuth>
                <RequireRole roles={['admin', 'superadmin', 'faculty']}>
                  <ShowcasePage />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Shared protected */}
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile/notifications"
            element={
              <RequireAuth>
                <NotificationPrefsPage />
              </RequireAuth>
            }
          />

          {/* Student */}
          <Route
            path="/student/*"
            element={
              <RequireAuth>
                <RequireRole roles={['student']}>
                  <Routes>
                    <Route path="dashboard" element={<StudentDashboard />} />
                    <Route path="courses" element={<StudentCourses />} />
                    <Route path="courses/:courseId" element={<StudentCoursePage />} />
                    <Route
                      path="courses/:courseId/sessions/:sessionId"
                      element={<StudentSessionPage />}
                    />
                    <Route
                      path="courses/:courseId/modules/:moduleId"
                      element={<StudentModuleView />}
                    />
                    <Route path="timetable" element={<StudentTimetable />} />
                    <Route path="fees" element={<StudentFees />} />
                    <Route path="tickets" element={<StudentTickets />} />
                    <Route path="tickets/new" element={<NewTicketPage />} />
                    <Route path="tickets/:ticketId" element={<StudentTicketDetail />} />
                    <Route path="feedback" element={<StudentFeedback />} />
                    <Route path="certificates" element={<StudentCertificates />} />
                    <Route path="quizzes/:quizId" element={<QuizAttemptPage />} />
                    <Route path="exams/:examId" element={<ExamAttemptPage />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Admin + Superadmin share screens (backend gates writes) */}
          <Route
            path="/admin/*"
            element={
              <RequireAuth>
                <RequireRole roles={['admin', 'superadmin']}>
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="users/new" element={<AdminInviteUser />} />
                    <Route path="users/:id" element={<AdminUserDetail />} />
                    {/* Faculty logins — create with generated passwords. */}
                    <Route path="faculty" element={<AdminFacultyPage />} />
                    <Route path="programs" element={<AdminPrograms />} />
                    <Route
                      path="programs/:id/admissions"
                      element={<AdminProgramAdmissionsPage />}
                    />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="batches" element={<AdminBatchesPage />} />
                    <Route path="batches/:id" element={<AdminBatchDetailPage />} />
                    <Route path="timetable" element={<AdminTimetableBuilderPage />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="tickets/sla-breaches" element={<AdminSlaBreachesPage />} />
                    <Route path="tickets/:ticketId" element={<AdminTicketDetailPage />} />
                    <Route path="enrollments" element={<AdminEnrollmentsPage />} />
                    <Route path="enrollments/:id" element={<AdminEnrollmentDetailPage />} />
                    <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                    <Route path="curriculum-import" element={<AdminCurriculumImport />} />
                    {/* Legacy admin paths redirect into the shared B-2 course shell. */}
                    <Route path="courses/:courseId/gradebook" element={<RedirectToCourseShell tail="gradebook" paramKey="courseId" />} />
                    <Route
                      path="courses/:courseId/assignments/:assignmentId/grading"
                      element={<RedirectAssignmentGrading paramKey="courseId" />}
                    />
                    <Route path="fee-structures" element={<AdminFeeStructuresPage />} />
                    <Route path="holidays" element={<AdminHolidaysPage />} />
                    {/* M10s — Visitor Leads (admin-captured prospect funnel). */}
                    <Route path="visitor-leads" element={<AdminVisitorLeadsPage />} />
                    {/* M10u — Staff attendance dashboard. */}
                    <Route path="staff-attendance" element={<AdminStaffAttendancePage />} />
                    {/* Entrance Exam — roster, window control + Q20 grading. */}
                    <Route path="entrance" element={<AdminEntranceExamPage />} />
                    <Route
                      path="entrance/candidates/:candidateId"
                      element={<AdminEntranceAttemptPage />}
                    />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Finance screens — M10r: admin handles all finance work now. URLs
              kept under /finance/* so existing bookmarks survive; sidebar nav
              surfaces them under the admin section. */}
          <Route
            path="/finance/*"
            element={
              <RequireAuth>
                <RequireRole roles={['admin', 'superadmin']}>
                  <Routes>
                    <Route path="dashboard" element={<FinanceDashboard />} />
                    <Route path="students" element={<FinanceStudentsPage />} />
                    <Route path="students/:id" element={<FinanceStudentDetailPage />} />
                    <Route path="students/:id/record-payment" element={<FinancePaymentNew />} />
                    <Route path="payments/new" element={<FinancePaymentNew />} />
                    <Route path="payments" element={<FinancePaymentsListPage />} />
                    <Route path="payments/:id" element={<FinancePaymentDetailPage />} />
                    <Route path="reports" element={<FinanceReportsPage />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Faculty */}
          <Route
            path="/faculty/*"
            element={
              <RequireAuth>
                <RequireRole roles={['faculty']}>
                  <Routes>
                    <Route path="dashboard" element={<FacultyDashboard />} />
                    <Route path="courses" element={<FacultyCoursesPage />} />
                    {/* Legacy faculty course-detail routes redirect into the
                        new B-2 shell at /courses/:id/*. The flat
                        FacultyCourseDetailPage stays mounted at a sub-path
                        for the announcements composer until B-3 ports it. */}
                    <Route path="courses/:id/legacy" element={<FacultyCourseDetailPage />} />
                    <Route path="courses/:id" element={<RedirectToCourseShell tail="overview" />} />
                    <Route path="courses/:id/gradebook" element={<RedirectToCourseShell tail="gradebook" />} />
                    <Route
                      path="courses/:courseId/assignments/:assignmentId/grading"
                      element={<RedirectAssignmentGrading />}
                    />
                    <Route path="grading" element={<FacultyGradingQueuePage />} />
                    <Route path="grading/:attemptId" element={<FacultyGradingDetailPage />} />
                    <Route path="feedback" element={<FacultyFeedbackPage />} />
                    <Route path="feedback/new" element={<FacultyFeedbackNewPage />} />
                    <Route path="timetable" element={<FacultyTimetablePage />} />
                    {/* M10o — Per-batch attendance landing page. */}
                    <Route path="batches/:batchId/attendance" element={<BatchAttendancePage />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Phase B-2 — shared course shell. Faculty + admin + superadmin
              share the same path namespace; each tab decides what it
              renders. Students get their own simpler /student/courses/:id. */}
          <Route
            path="/courses/:id/*"
            element={
              <RequireAuth>
                <RequireRole roles={['faculty', 'admin', 'superadmin']}>
                  <CourseShell />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route path="*" element={<LandingRedirect />} />
        </Routes>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
