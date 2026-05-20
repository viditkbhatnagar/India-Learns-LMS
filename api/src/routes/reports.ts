import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { REPORT_FORMATS } from 'india-learns-shared-types';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import { Enrollment } from '../models/index.js';
import {
  buildAssignmentSubmissionsReport,
  buildAttendanceReport,
  buildBatchSummaryReport,
} from '../services/reportsService.js';
import {
  renderAssignmentSubmissionsReportPdf,
  renderAssignmentSubmissionsReportXlsx,
  renderAttendanceReportPdf,
  renderAttendanceReportXlsx,
  renderBatchSummaryReportPdf,
  renderBatchSummaryReportXlsx,
} from '../services/reportRenderers.js';

// M10 — Reports module routes (LMS_Faculty_Features §4).
//
// Three endpoints, each accepting `?format=json|xlsx|pdf`. JSON is the
// default so the web Reports page can render a preview before the user
// downloads. XLSX is for analyst workflows; PDF is the shareable
// summary (M10i).
//
// Auth model:
// - admin / superadmin / finance / admissions_officer → any batch
// - faculty → only batches they teach (assessed by membership on at least
//   one course in the batch via Enrollment-by-courseId lookup against
//   FacultyCourse if the model exists; v1 takes the pragmatic shortcut of
//   "faculty is listed on the course assigned to this batch")

const FormatQuery = z.object({
  format: z.enum(REPORT_FORMATS).default('json'),
});

const BatchScopedQuery = z.object({
  batchId: z.string().min(1),
});

const RangeScopedQuery = z.object({
  batchId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  courseId: z.string().min(1).optional(),
});

async function assertFacultyOwnsBatch(
  req: Request,
  batchId: string,
): Promise<void> {
  if (req.auth!.role !== 'faculty') return;
  // Faculty can read a batch report iff they're listed on at least one
  // enrolment in that batch (i.e., they teach a course in the batch).
  // We look at Course.facultyIds via the Enrollment → Course join.
  if (!Types.ObjectId.isValid(batchId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  }
  const enrolments = await Enrollment.find({ batchId: new Types.ObjectId(batchId) })
    .select({ courseId: 1 })
    .populate<{ courseId: { facultyIds?: Types.ObjectId[] } }>(
      'courseId',
      'facultyIds',
    )
    .lean();
  const teaches = enrolments.some((e) => {
    const course = e.courseId as unknown as { facultyIds?: Types.ObjectId[] } | null;
    return course?.facultyIds?.some((fid) => fid.toString() === req.auth!.userId.toString());
  });
  if (!teaches) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not teach any course in this batch.');
  }
}

function sendXlsx(res: Response, filename: string, buf: Buffer): void {
  res
    .status(200)
    .setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buf);
}

function sendPdf(res: Response, filename: string, buf: Buffer): void {
  res
    .status(200)
    .setHeader('Content-Type', 'application/pdf')
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buf);
}

export function reportsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(
    requireRole('admin', 'superadmin', 'finance', 'admissions_officer', 'faculty'),
  );

  // GET /v1/reports/attendance
  router.get(
    '/attendance',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { format } = FormatQuery.parse(req.query);
        const filters = RangeScopedQuery.parse(req.query);
        await assertFacultyOwnsBatch(req, filters.batchId);
        const report = await buildAttendanceReport({
          batchId: filters.batchId,
          from: filters.from,
          to: filters.to,
          courseId: filters.courseId ?? null,
        });
        if (format === 'xlsx') {
          const buf = await renderAttendanceReportXlsx(report);
          sendXlsx(res, `attendance-${report.batchCode}-${filters.from}-to-${filters.to}.xlsx`, buf);
          return;
        }
        if (format === 'pdf') {
          const buf = await renderAttendanceReportPdf(report);
          sendPdf(res, `attendance-${report.batchCode}-${filters.from}-to-${filters.to}.pdf`, buf);
          return;
        }
        res.status(200).json({ data: report });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /v1/reports/batch-summary
  router.get(
    '/batch-summary',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { format } = FormatQuery.parse(req.query);
        const filters = BatchScopedQuery.parse(req.query);
        await assertFacultyOwnsBatch(req, filters.batchId);
        const report = await buildBatchSummaryReport({ batchId: filters.batchId });
        if (format === 'xlsx') {
          const buf = await renderBatchSummaryReportXlsx(report);
          sendXlsx(res, `batch-summary-${report.batchCode}.xlsx`, buf);
          return;
        }
        if (format === 'pdf') {
          const buf = await renderBatchSummaryReportPdf(report);
          sendPdf(res, `batch-summary-${report.batchCode}.pdf`, buf);
          return;
        }
        res.status(200).json({ data: report });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /v1/reports/assignment-submissions
  router.get(
    '/assignment-submissions',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { format } = FormatQuery.parse(req.query);
        const filters = RangeScopedQuery.parse(req.query);
        await assertFacultyOwnsBatch(req, filters.batchId);
        const report = await buildAssignmentSubmissionsReport({
          batchId: filters.batchId,
          from: filters.from,
          to: filters.to,
          courseId: filters.courseId ?? null,
        });
        if (format === 'xlsx') {
          const buf = await renderAssignmentSubmissionsReportXlsx(report);
          sendXlsx(
            res,
            `assignments-${report.batchCode}-${filters.from}-to-${filters.to}.xlsx`,
            buf,
          );
          return;
        }
        if (format === 'pdf') {
          const buf = await renderAssignmentSubmissionsReportPdf(report);
          sendPdf(
            res,
            `assignments-${report.batchCode}-${filters.from}-to-${filters.to}.pdf`,
            buf,
          );
          return;
        }
        res.status(200).json({ data: report });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
