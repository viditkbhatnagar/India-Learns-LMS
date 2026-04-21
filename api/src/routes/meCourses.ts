import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  listEnrollmentsForStudent,
  toEnrollmentDto,
} from '../services/enrollmentService.js';
import { findCourseById, toCourseDto } from '../services/courseService.js';
import { listModulesForCourse, toModuleDto } from '../services/moduleService.js';
import { assertStudentCanAccessCourse } from '../services/moduleAccessService.js';

export function meCoursesRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('student'));

  // Alias of /v1/enrollments/me per D-031.
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await listEnrollmentsForStudent(req.auth!.userId);
        res.status(200).json({ data: { enrolments: docs.map(toEnrollmentDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:courseId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const course = await findCourseById(req.params.courseId ?? '');
        if (!course) {
          throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
        }
        // Full student-access gate — rejects sandbox, non-enrolled, expired, and
        // fee-suspended students before any module URLs are exposed.
        const { enrolment } = await assertStudentCanAccessCourse(
          req.auth!.user,
          course,
        );
        const modules = await listModulesForCourse(course._id.toString());
        res.status(200).json({
          data: {
            course: toCourseDto(course),
            enrolment: toEnrollmentDto(enrolment),
            modules: modules.map(toModuleDto),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
