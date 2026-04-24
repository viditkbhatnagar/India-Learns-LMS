import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  createCourse,
  deleteCourse,
  facultyAssignedToCourse,
  findCourseById,
  listCourses,
  publishCourse,
  toCourseDto,
  unpublishCourse,
  updateCourse,
} from '../services/courseService.js';
import {
  createModule,
  listModulesForCourse,
  toModuleDto,
} from '../services/moduleService.js';

const CreateBody = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  summary: z.string().max(5000).optional(),
  sequential: z.boolean().optional(),
  certificateTemplateId: z.string().nullable().optional(),
  facultyIds: z.array(z.string()).max(50).optional(),
});

const UpdateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  summary: z.string().max(5000).optional(),
  sequential: z.boolean().optional(),
  certificateTemplateId: z.string().nullable().optional(),
  facultyIds: z.array(z.string()).max(50).optional(),
});

const ListQuery = z.object({
  programId: z.string().optional(),
  state: z.enum(['sandbox', 'published']).optional(),
  facultyId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const CreateModuleBody = z.object({
  title: z.string().min(1).max(200),
  order: z.coerce.number().int().min(0),
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
});

function requestContext(req: Request) {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? '',
    ua: req.header('user-agent') ?? '',
  };
}

export function coursesRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = ListQuery.parse(req.query);
        const scoped =
          req.auth!.role === 'faculty'
            ? { ...query, facultyId: req.auth!.userId.toString() }
            : query;
        const result = await listCourses(scoped);
        res.status(200).json({
          data: {
            items: result.items.map(toCourseDto),
            total: result.total,
            page: result.page,
            limit: result.limit,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateBody.parse(req.body);
        const doc = await createCourse(body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await findCourseById(req.params.id ?? '');
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
        if (
          req.auth!.role === 'faculty' &&
          !facultyAssignedToCourse(doc, req.auth!.userId)
        ) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }
        res.status(200).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = UpdateBody.parse(req.body);
        const doc = await updateCourse(req.params.id ?? '', body, {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/publish',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await publishCourse(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/unpublish',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await unpublishCourse(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    '/:id',
    requireRole('admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await deleteCourse(req.params.id ?? '', {
          role: req.auth!.role,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(200).json({ data: { course: toCourseDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/:id/modules',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const course = await findCourseById(req.params.id ?? '');
        if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
        if (
          req.auth!.role === 'faculty' &&
          !facultyAssignedToCourse(course, req.auth!.userId)
        ) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }
        const modules = await listModulesForCourse(course._id.toString());
        res.status(200).json({ data: { items: modules.map(toModuleDto) } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/:id/modules',
    requireRole('admin', 'superadmin', 'faculty'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateModuleBody.parse(req.body);
        const doc = await createModule(req.params.id ?? '', body, {
          role: req.auth!.role,
          userId: req.auth!.userId,
          actorUserId: req.auth!.userId,
          ...requestContext(req),
        });
        res.status(201).json({ data: { module: toModuleDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
