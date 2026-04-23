import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { Course, Exam, ExamAttempt } from '../models/index.js';
import { toExamAttemptDto } from '../services/examService.js';

/**
 * GET /v1/staff/grading-queue
 *
 * Returns exam attempts awaiting essay grading.
 *  - Faculty: only attempts on courses they're assigned to (facultyIds).
 *  - Admin / Superadmin: all attempts org-wide.
 *
 * Shape matches the other list endpoints: { data: { items: ExamAttemptDto[] } }.
 * The client renders the list on /faculty/grading.
 */
export function staffGradingRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = req.auth!;
        let examIds: Types.ObjectId[] | null = null;

        if (actor.role === 'faculty') {
          // Narrow to exams on courses this faculty teaches.
          const myCourses = await Course.find({ facultyIds: actor.userId })
            .select('_id')
            .lean();
          if (myCourses.length === 0) {
            res.json({ data: { items: [] } });
            return;
          }
          const exams = await Exam.find({
            courseId: { $in: myCourses.map((c) => c._id) },
          })
            .select('_id')
            .lean();
          examIds = exams.map((e) => e._id);
        }

        const attempts = await ExamAttempt.find({
          submittedAt: { $ne: null },
          totalScorePercent: null,
          ...(examIds ? { examId: { $in: examIds } } : {}),
        })
          .sort({ submittedAt: 1 }) // oldest first — easy visual triage
          .limit(100);

        res.json({ data: { items: attempts.map(toExamAttemptDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
