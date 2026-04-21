import { Router } from 'express';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { programsRouter } from './programs.js';
import { coursesRouter } from './courses.js';
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

export function v1Router(): Router {
  const router = Router();
  // Cron endpoints mount BEFORE the session-wide fees-suspension guard so
  // unauthenticated HMAC-signed calls from Render can hit them.
  router.use('/jobs', jobsFeesRouter());

  router.use('/auth', authRouter());
  router.use('/users', usersRouter());
  router.use('/users', suspensionOverrideRouter());
  router.use('/programs', programsRouter());
  router.use('/courses', coursesRouter());
  router.use('/modules', modulesRouter());
  router.use('/batches', batchesRouter());
  router.use('/batches', batchTimetableRouter());
  router.use('/enrollments', enrollmentsRouter());
  router.use('/enrollments', generateFeesRouter());
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
  router.use('/fee-structures', feeStructuresRouter());
  router.use('/payments', paymentsRouter());
  router.use('/finance/payments', paymentsRouter());
  router.use('/receipts', receiptsRouter());
  router.use('/fees', feeRemindersRouter());

  // Note: fees-suspension enforcement lives inside requireAuth itself — it
  // emits 403 FEES_SUSPENDED for non-whitelisted routes when the user's
  // status==='suspended' && suspensionKind==='fees' (see middleware/auth.ts).
  return router;
}
