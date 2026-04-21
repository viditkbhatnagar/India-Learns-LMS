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

export function v1Router(): Router {
  const router = Router();
  router.use('/auth', authRouter());
  router.use('/users', usersRouter());
  router.use('/programs', programsRouter());
  router.use('/courses', coursesRouter());
  router.use('/modules', modulesRouter());
  router.use('/batches', batchesRouter());
  router.use('/enrollments', enrollmentsRouter());
  router.use('/me/courses', meCoursesRouter());
  router.use('/students/me', studentDashboardRouter());
  router.use('/storage', storageRouter());
  return router;
}
