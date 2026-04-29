import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  assertStudentCanViewModule,
  recordModuleViewed,
} from '../services/moduleAccessService.js';
import {
  deleteModule,
  findModuleById,
  toModuleDto,
  updateModule,
} from '../services/moduleService.js';
import { facultyAssignedToCourse, findCourseById } from '../services/courseService.js';

const UpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  order: z.coerce.number().int().min(0).optional(),
  content: z
    .array(
      z.object({
        kind: z.enum(['video', 'pdf', 'text', 'quizRef']),
        title: z.string().min(1).max(200),
        videoUrl: z.string().url().nullable().optional(),
        pdfUrl: z.string().url().nullable().optional(),
        pdfStorageKey: z.string().nullable().optional(),
        allowDownload: z.boolean().optional(),
        textMarkdown: z.string().nullable().optional(),
        quizId: z.string().nullable().optional(),
      }),
    )
    .optional(),
  // PR #16 — faculty-editable curriculum metadata for the "module
  // overview" panel. Aim is the description shown to faculty + students;
  // facultyNotes is private to staff.
  aim: z.string().max(8000).optional(),
  prerequisites: z.array(z.string().max(500)).max(50).optional(),
  facultyNotes: z.string().max(8000).optional(),
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function modulesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const mod = await findModuleById(req.params.id ?? '');
        if (!mod) throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
        const { role, user, userId } = req.auth!;
        if (role === 'student') {
          const ctx = await assertStudentCanViewModule(user, mod);
          await recordModuleViewed(user, mod, ctx, requestContext(req));
          res.status(200).json({ data: { module: toModuleDto(mod) } });
          return;
        }
        if (role === 'faculty') {
          const course = await findCourseById(mod.courseId.toString());
          if (!course) {
            throw new HttpError(404, 'NOT_FOUND', 'Module not found.');
          }
          if (!facultyAssignedToCourse(course, userId)) {
            throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
          }
        }
        res.status(200).json({ data: { module: toModuleDto(mod) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateModule(req.params.id ?? '', body, {
          role: req.auth!.role,
          userId: req.auth!.userId,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { module: toModuleDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteModule(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { module: toModuleDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
