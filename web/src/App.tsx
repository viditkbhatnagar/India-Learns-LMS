import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role } from 'india-learns-shared-types';
import { RequireAuth, RequireRole, defaultRouteForRole } from './components/guards.js';
import { useAuthStore } from './store/auth.js';
import { ErrorBoundary } from './components/ui/States.js';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage.js';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.js';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage.js';

// Student
import { StudentDashboard } from './pages/student/StudentDashboard.js';
import {
  StudentCourses,
  StudentCourseDetail,
  StudentModuleView,
} from './pages/student/StudentCourses.js';
import { StudentTimetable } from './pages/student/StudentTimetable.js';
import { StudentFees } from './pages/student/StudentFees.js';
import {
  StudentTickets,
  NewTicketPage,
  StudentTicketDetail,
} from './pages/student/StudentTickets.js';
import { StudentFeedback } from './pages/student/StudentFeedback.js';
import { StudentCertificates } from './pages/student/StudentCertificates.js';

// Admin
import { AdminDashboard } from './pages/admin/AdminDashboard.js';
import {
  AdminUsers,
  AdminInviteUser,
  AdminUserDetail,
} from './pages/admin/AdminUsers.js';
import { AdminTickets } from './pages/admin/AdminTickets.js';
import { AdminPrograms, AdminCourses } from './pages/admin/AdminPrograms.js';

// Finance
import { FinanceDashboard } from './pages/finance/FinanceDashboard.js';
import {
  FinancePaymentNew,
  FinancePayments,
} from './pages/finance/FinancePayment.js';

// Faculty
import { FacultyDashboard } from './pages/faculty/FacultyDashboard.js';

// Shared
import { ProfilePage, NotificationPrefsPage } from './pages/ProfilePage.js';
import { Placeholder } from './pages/Placeholder.js';

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
                    <Route path="courses/:courseId" element={<StudentCourseDetail />} />
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
                    <Route path="quizzes/:quizId" element={<Placeholder title="Quiz attempt" message="Quiz attempt UI ships in M9 alongside the exam flow. Use the mobile app for launch." />} />
                    <Route path="exams/:examId" element={<Placeholder title="Exam attempt" />} />
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
                    <Route path="programs" element={<AdminPrograms />} />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="batches" element={<Placeholder title="Batches" />} />
                    <Route path="timetable" element={<Placeholder title="Timetable builder" />} />
                    <Route path="tickets" element={<AdminTickets />} />
                    <Route path="tickets/:ticketId" element={<Placeholder title="Ticket detail" />} />
                    <Route path="enrollments" element={<Placeholder title="Enrollments" />} />
                    <Route path="enrollments/:id" element={<Placeholder title="Enrolment detail (Issue Certificate button)" message="The POST /v1/enrollments/:id/issue-certificate endpoint is wired — use the student certificates screen or curl for now." />} />
                    <Route path="audit-logs" element={<Placeholder title="Audit logs" />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Finance */}
          <Route
            path="/finance/*"
            element={
              <RequireAuth>
                <RequireRole roles={['finance']}>
                  <Routes>
                    <Route path="dashboard" element={<FinanceDashboard />} />
                    <Route path="payments/new" element={<FinancePaymentNew />} />
                    <Route path="payments" element={<FinancePayments />} />
                    <Route path="fee-structures" element={<Placeholder title="Fee structures" />} />
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
                    <Route path="courses" element={<Placeholder title="My courses" />} />
                    <Route path="courses/:id" element={<Placeholder title="Course detail" />} />
                    <Route path="grading" element={<Placeholder title="Grading queue" />} />
                    <Route path="feedback" element={<Placeholder title="Feedback editor" />} />
                    <Route path="timetable" element={<Placeholder title="My timetable" />} />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                  </Routes>
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
