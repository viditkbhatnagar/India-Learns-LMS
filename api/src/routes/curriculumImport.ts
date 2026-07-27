import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { buildLessonPlanImportLimiter } from '../middleware/rateLimit.js';
import { HttpError } from '../middleware/error.js';
import { extractDocxText } from '../services/curriculumImport/docxExtract.js';
import { parseLessonPlan, type ParsedLessonPlan } from '../services/curriculumImport/lessonPlanParser.js';
import {
  checkGeneratorHealth,
  listAvailableWorkflows,
  previewImport,
  runImport,
} from '../services/curriculumImport/index.js';
import { ingestLessonPlan } from '../services/curriculumImport/lessonIngest.js';

const IngestLessonBody = z.object({
  title: z.string().trim().min(1).max(240),
  plannedMinutes: z.number().int().min(0).max(600).nullable().optional(),
  description: z.string().max(8000).optional(),
  objectives: z.array(z.string().max(2000)).max(60).optional(),
});
const IngestModuleBody = z.object({
  title: z.string().trim().min(1).max(200),
  lessons: z.array(IngestLessonBody).max(500),
});
const IngestLessonsBody = z.object({
  programId: z.string().min(1),
  name: z.string().min(1).max(200),
  slug: z.string().max(200).optional(),
  courseId: z.string().optional(),
  modules: z.array(IngestModuleBody).min(1).max(60),
});

const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

type UploadReq = Request & { file?: { buffer: Buffer; originalname: string } };

function parseUploadedDoc(file: UploadReq['file']): { parsed: ParsedLessonPlan; lessonCount: number } {
  if (!file) throw new HttpError(422, 'VALIDATION_FAILED', 'No file was uploaded — attach a .docx.');
  const parsed = parseLessonPlan(extractDocxText(file.buffer));
  const lessonCount = parsed.modules.reduce((n, m) => n + m.lessons.length, 0);
  if (parsed.modules.length === 0 || lessonCount === 0) {
    throw new HttpError(
      422,
      'PARSE_EMPTY',
      'No lessons were found. The document needs module headings ("MOD101:" or "M1:") and "Lesson N:" lines under them.',
    );
  }
  return { parsed, lessonCount };
}

const PreviewQuery = z.object({
  workflowId: z.string().min(1),
});

const RunBody = z.object({
  workflowId: z.string().min(1),
  programId: z.string().min(1),
  replace: z.boolean().optional(),
});

export function curriculumImportRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  // Generator-backed endpoints stay super-admin only (the gate doubles as a
  // Phase-A feature flag). The lesson-plan (Word document) endpoints below are
  // additionally open to faculty so a teacher can maintain their own course's
  // lessons — `ingestLessonPlan` enforces that they may only replace a course
  // they teach.
  const generatorOnly = requireRole('superadmin');
  const lessonPlanRoles = requireRole('superadmin', 'faculty');
  // Rate-limit BEFORE multer so a flood is rejected without buffering 15 MB.
  const uploadLimiter = buildLessonPlanImportLimiter();

  router.get(
    '/health',
    generatorOnly,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await checkGeneratorHealth();
        res.json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // Ingest a hand-finalized lesson plan (structured modules/lessons parsed
  // from a Word document) — creates a new course or replaces an existing
  // course's lessons wholesale.
  router.post(
    '/lessons',
    lessonPlanRoles,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = IngestLessonsBody.parse(req.body);
        const result = await ingestLessonPlan(body, req.auth!);
        res.status(201).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // Preview a lesson-plan Word file: parse it and return module/lesson counts
  // without saving anything.
  router.post(
    '/parse-file',
    lessonPlanRoles,
    uploadLimiter,
    docxUpload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { parsed, lessonCount } = parseUploadedDoc((req as UploadReq).file);
        const suggestedName = ((req as UploadReq).file?.originalname ?? '')
          .replace(/\.docx$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\s+step\s*10.*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        res.json({
          data: {
            suggestedName,
            moduleCount: parsed.modules.length,
            lessonCount,
            modules: parsed.modules.map((m) => ({ title: m.title, lessons: m.lessons.length })),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Upload a lesson-plan Word file and create/replace a course from it.
  router.post(
    '/lessons-file',
    lessonPlanRoles,
    uploadLimiter,
    docxUpload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { parsed } = parseUploadedDoc((req as UploadReq).file);
        const fields = z
          .object({
            programId: z.string().min(1),
            name: z.string().min(1).max(200),
            courseId: z.string().optional(),
          })
          .parse(req.body);
        const result = await ingestLessonPlan(
          { programId: fields.programId, name: fields.name, courseId: fields.courseId || undefined, modules: parsed.modules },
          req.auth!,
        );
        res.status(201).json({ data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/workflows',
    generatorOnly,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const items = await listAvailableWorkflows(req.auth!);
        res.json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    '/preview',
    generatorOnly,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { workflowId } = PreviewQuery.parse(req.query);
        const preview = await previewImport(req.auth!, workflowId);
        res.json({ data: preview });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/',
    generatorOnly,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = RunBody.parse(req.body);
        const result = await runImport(req.auth!, body, {
          ip: req.ip ?? '',
          ua: req.header('user-agent') ?? '',
        });
        res.status(201).json({
          data: {
            workflowId: result.workflowId,
            courseId: String(result.courseId),
            created: result.created,
            warnings: result.warnings,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
