import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { programsRouter } from './programs.js';
import { coursesRouter } from './courses.js';
import { courseAnnouncementsRouter } from './announcements.js';
import {
  assignmentSubmissionsRouter,
  assignmentsRouter,
  courseAssignmentsRouter,
  courseGradebookRouter,
} from './assignments.js';
import { modulesRouter } from './modules.js';
import { batchesRouter } from './batches.js';
import { enrollmentsRouter } from './enrollments.js';
import { meCoursesRouter } from './meCourses.js';
import { studentDashboardRouter } from './studentDashboard.js';
import { storageRouter } from './storage.js';
import {
  batchTimetableRouter,
  timetableEntriesRouter,
} from './timetableEntries.js';
import { timetableOverridesRouter } from './timetableOverrides.js';
import { timetableRouter } from './timetable.js';
import { meTimetableRouter } from './meTimetable.js';
import { holidaysRouter } from './holidays.js';
import { notificationsRouter } from './notifications.js';
import { feeStructuresRouter } from './feeStructures.js';
import { generateFeesRouter } from './generateFees.js';
import { studentFeesRouter, myFeesRouter } from './studentFees.js';
import { paymentsRouter } from './payments.js';
import { receiptsRouter } from './receipts.js';
import { feeRemindersRouter } from './feeReminders.js';
import { suspensionOverrideRouter } from './suspensionOverride.js';
import { jobsFeesRouter } from './jobsFees.js';
import { jobsSlaRouter } from './jobsSla.js';
import { jobsFacultyDigestRouter } from './jobsFacultyDigest.js';
import { ticketsRouter } from './tickets.js';
import { meTicketsRouter } from './meTickets.js';
import { auditLogsRouter } from './auditLogs.js';
import { staffGradingRouter } from './staffGrading.js';
import { staffTicketsRouter } from './staffTickets.js';
import { quizzesRouter, quizAttemptsRouter } from './quizzes.js';
import { examsRouter, examAttemptsRouter } from './exams.js';
import { rubricsRouter } from './rubrics.js';
import { feedbackRouter, meFeedbackRouter } from './feedback.js';
import {
  enrollmentCertificateAdminRouter,
  meCertificatesRouter,
} from './certificates.js';
import {
  meNotificationsAliasRouter,
  notificationPrefsRouter,
} from './notificationPrefs.js';
import { analyticsRouter } from './analytics.js';
import { jobsNotificationsRouter } from './jobsNotifications.js';
import { curriculumImportRouter } from './curriculumImport.js';
import { courseSessionsRouter, sessionsRouter } from './sessions.js';
import { materialsRouter } from './materials.js';

export function v1Router(): Router {
  const router = Router();
  // Cron endpoints mount BEFORE the session-wide fees-suspension guard so
  // unauthenticated HMAC-signed calls from Render can hit them.
  router.use('/jobs', jobsFeesRouter());
  router.use('/jobs', jobsSlaRouter());
  router.use('/jobs', jobsFacultyDigestRouter());
  router.use('/jobs', jobsNotificationsRouter());

  router.use('/auth', authRouter());
  router.use('/users', usersRouter());
  router.use('/users', suspensionOverrideRouter());
  router.use('/programs', programsRouter());
  router.use('/courses', coursesRouter());
  router.use('/courses/:courseId/announcements', courseAnnouncementsRouter());
  router.use('/courses/:courseId/assignments', courseAssignmentsRouter());
  router.use('/courses/:courseId/gradebook', courseGradebookRouter());
  router.use('/courses/:courseId/sessions', courseSessionsRouter());
  router.use('/sessions', sessionsRouter());
  router.use('/materials', materialsRouter());
  router.use('/assignments', assignmentsRouter());
  router.use('/assignment-submissions', assignmentSubmissionsRouter());
  router.use('/modules', modulesRouter());
  router.use('/batches', batchesRouter());
  router.use('/batches', batchTimetableRouter());
  router.use('/enrollments', enrollmentsRouter());
  router.use('/enrollments', generateFeesRouter());
  // M8 — admin certificate retry lives alongside enrolments.
  router.use('/enrollments', enrollmentCertificateAdminRouter());
  router.use('/me/courses', meCoursesRouter());
  router.use('/me/timetable', meTimetableRouter());
  router.use('/students/me', studentDashboardRouter());
  router.use('/students/me', myFeesRouter());
  router.use('/students', studentFeesRouter());
  router.use('/storage', storageRouter());
  router.use('/timetable/overrides', timetableOverridesRouter());
  router.use('/timetable', timetableRouter());
  router.use('/timetable', timetableEntriesRouter());
  router.use('/holidays', holidaysRouter());
  router.use('/notifications', notificationsRouter());
  // M8 — TRD §5.11 paths (`/v1/me/notifications` + `/v1/me/notification-prefs`)
  // live alongside the M4 alias router at `/v1/notifications/me`.
  router.use('/me/notifications', meNotificationsAliasRouter());
  router.use('/me/notification-prefs', notificationPrefsRouter());
  router.use('/me/certificates', meCertificatesRouter());
  router.use('/analytics', analyticsRouter());
  router.use('/fee-structures', feeStructuresRouter());
  router.use('/payments', paymentsRouter());
  router.use('/finance/payments', paymentsRouter());
  router.use('/receipts', receiptsRouter());
  router.use('/fees', feeRemindersRouter());
  // /v1/me/tickets and /v1/tickets/me are aliases (D-031) — both land on
  // `meTicketsRouter`. `/tickets/me` must mount BEFORE `/tickets` so the
  // literal `/me` segment isn't swallowed by the `/:id` handler.
  router.use('/me/tickets', meTicketsRouter());
  router.use('/tickets/me', meTicketsRouter());
  router.use('/audit-logs', auditLogsRouter());
  router.use('/curriculum-import', curriculumImportRouter());
  router.use('/staff/grading-queue', staffGradingRouter());
  router.use('/staff/tickets', staffTicketsRouter());
  router.use('/tickets', ticketsRouter());

  // M7 — Assessments + Rubric Feedback. `/quiz-attempts` and `/exam-attempts`
  // mount under their own namespaces so the `/submit`, `/grade` POST/PATCH
  // routes don't collide with the parent `/quizzes/:id` or `/exams/:id`
  // handlers.
  router.use('/quizzes', quizzesRouter());
  router.use('/quiz-attempts', quizAttemptsRouter());
  router.use('/exams', examsRouter());
  router.use('/exam-attempts', examAttemptsRouter());
  router.use('/rubrics', rubricsRouter());
  // `/me/feedback` mounts BEFORE `/feedback` so the literal `/me` segment
  // isn't swallowed by the `/:id` handler (same pattern as tickets).
  router.use('/me/feedback', meFeedbackRouter());
  router.use('/feedback', feedbackRouter());

  // Note: fees-suspension enforcement lives inside requireAuth itself — it
  // emits 403 FEES_SUSPENDED for non-whitelisted routes when the user's
  // status==='suspended' && suspensionKind==='fees' (see middleware/auth.ts).
  return router;
}
