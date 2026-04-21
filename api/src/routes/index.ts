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

export function v1Router(): Router {
  const router = Router();
  router.use('/auth', authRouter());
  router.use('/users', usersRouter());
  router.use('/programs', programsRouter());
  router.use('/courses', coursesRouter());
  router.use('/modules', modulesRouter());
  router.use('/batches', batchesRouter());
  router.use('/batches', batchTimetableRouter());
  router.use('/enrollments', enrollmentsRouter());
  router.use('/me/courses', meCoursesRouter());
  router.use('/me/timetable', meTimetableRouter());
  router.use('/students/me', studentDashboardRouter());
  router.use('/storage', storageRouter());
  router.use('/timetable/overrides', timetableOverridesRouter());
  router.use('/timetable', timetableRouter());
  router.use('/timetable', timetableEntriesRouter());
  router.use('/holidays', holidaysRouter());
  router.use('/notifications', notificationsRouter());
  return router;
}
