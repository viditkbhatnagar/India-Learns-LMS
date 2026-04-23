import { Router, type NextFunction, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { HttpError } from '../middleware/error.js';
import {
  Assignment,
  AssignmentSubmission,
  Course,
  Enrollment,
  User,
  type HydratedAssignment,
  type HydratedAssignmentSubmission,
  type HydratedCourse,
} from '../models/index.js';
import { recordAudit } from '../services/auditService.js';
import { enqueueNotification } from '../services/notificationService.js';

const CreateAssignmentBody = z.object({
  title: z.string().min(1).max(240),
  instructions: z.string().min(1).max(8000),
  dueAt: z.string().datetime(),
  maxScore: z.number().int().min(1).max(1000),
  moduleId: z.string().min(1).nullable().optional(),
});

const UpdateAssignmentBody = z.object({
  title: z.string().min(1).max(240).optional(),
  instructions: z.string().min(1).max(8000).optional(),
  dueAt: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  state: z.enum(['open', 'closed']).optional(),
});

const SubmitBody = z.object({
  bodyText: z.string().max(16_000).optional(),
  attachmentUrl: z.string().url().max(2048).nullable().optional(),
});

const GradeBody = z.object({
  score: z.number().min(0),
  feedback: z.string().max(4000).optional(),
});

function toAssignmentDto(doc: HydratedAssignment) {
  return {
    id: doc._id.toString(),
    courseId: doc.courseId.toString(),
    moduleId: doc.moduleId ? doc.moduleId.toString() : null,
    authorUserId: doc.authorUserId.toString(),
    title: doc.title,
    instructions: doc.instructions,
    dueAt: doc.dueAt.toISOString(),
    maxScore: doc.maxScore,
    state: doc.state,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toSubmissionDto(doc: HydratedAssignmentSubmission) {
  return {
    id: doc._id.toString(),
    assignmentId: doc.assignmentId.toString(),
    courseId: doc.courseId.toString(),
    studentId: doc.studentId.toString(),
    bodyText: doc.bodyText,
    attachmentUrl: doc.attachmentUrl,
    submittedAt: doc.submittedAt.toISOString(),
    score: doc.score,
    feedback: doc.feedback,
    gradedByUserId: doc.gradedByUserId ? doc.gradedByUserId.toString() : null,
    gradedAt: doc.gradedAt ? doc.gradedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function loadCourseOr404(courseId: string): Promise<HydratedCourse> {
  if (!Types.ObjectId.isValid(courseId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  }
  const course = await Course.findOne({ _id: courseId, deletedAt: null });
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  return course;
}

function facultyCanWrite(course: HydratedCourse, userId: Types.ObjectId): boolean {
  return course.facultyIds.some((id) => id.equals(userId));
}

/** Mounted at /v1/courses/:courseId/assignments. */
export function courseAssignmentsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  // List assignments for a course — every enrolled student + faculty + admin
  // can see. Student gets their own submission embedded per assignment.
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const course = await loadCourseOr404(req.params.courseId ?? '');
        const { role, userId } = req.auth!;

        if (role === 'student') {
          const enrolled = await Enrollment.findOne({
            studentId: userId,
            courseId: course._id,
            status: 'active',
          });
          if (!enrolled) {
            throw new HttpError(403, 'FORBIDDEN', 'Not enrolled in this course.');
          }
        } else if (role === 'faculty') {
          if (!facultyCanWrite(course, userId)) {
            throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
          }
        } else if (role !== 'admin' && role !== 'superadmin') {
          throw new HttpError(403, 'FORBIDDEN', 'Role cannot view assignments.');
        }

        const assignments = await Assignment.find({
          courseId: course._id,
          deletedAt: null,
        })
          .sort({ dueAt: 1 })
          .limit(200);

        let mySubs: Map<string, HydratedAssignmentSubmission> = new Map();
        if (role === 'student') {
          const subs = await AssignmentSubmission.find({
            assignmentId: { $in: assignments.map((a) => a._id) },
            studentId: userId,
          });
          mySubs = new Map(subs.map((s) => [s.assignmentId.toString(), s]));
        }

        res.json({
          data: {
            items: assignments.map((a) => ({
              ...toAssignmentDto(a),
              mySubmission: mySubs.get(a._id.toString())
                ? toSubmissionDto(mySubs.get(a._id.toString())!)
                : null,
            })),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Faculty (assigned) or admin creates an assignment.
  router.post(
    '/',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const course = await loadCourseOr404(req.params.courseId ?? '');
        const { role, userId } = req.auth!;
        if (role === 'faculty' && !facultyCanWrite(course, userId)) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }
        const body = CreateAssignmentBody.parse(req.body);
        const moduleId = body.moduleId && Types.ObjectId.isValid(body.moduleId)
          ? new Types.ObjectId(body.moduleId)
          : null;
        const doc = await Assignment.create({
          courseId: course._id,
          moduleId,
          authorUserId: userId,
          title: body.title.trim(),
          instructions: body.instructions.trim(),
          dueAt: new Date(body.dueAt),
          maxScore: body.maxScore,
        });
        await recordAudit({
          actorUserId: userId,
          action: 'assignment.created',
          targetType: 'Assignment',
          targetId: doc._id,
          after: doc.toObject(),
          details: { courseId: course._id.toString() },
          ip: req.ip,
          ua: req.header('user-agent') ?? '',
        });

        // Notify every active-enrolled student in this course.
        try {
          const enrolments = await Enrollment.find({
            courseId: course._id,
            status: 'active',
          }).select('studentId');
          const recipients = enrolments.map((e) => e.studentId);
          if (recipients.length > 0) {
            await enqueueNotification({
              type: 'assignment.created',
              recipients,
              title: `New assignment: ${doc.title}`,
              body: `Due ${doc.dueAt.toISOString().slice(0, 10)}`,
              data: {
                assignmentId: doc._id.toString(),
                courseId: course._id.toString(),
              },
            });
          }
        } catch {
          // non-fatal
        }

        res.status(201).json({ data: { assignment: toAssignmentDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mounted at /v1/assignments. */
export function assignmentsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Get one assignment + (for students) your own submission.
  router.get(
    '/:id',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');
        }
        const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
        if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');

        const course = await loadCourseOr404(assignment.courseId.toString());
        const { role, userId } = req.auth!;
        let mySubmission: HydratedAssignmentSubmission | null = null;
        if (role === 'student') {
          const enrolled = await Enrollment.findOne({
            studentId: userId,
            courseId: course._id,
            status: 'active',
          });
          if (!enrolled) throw new HttpError(403, 'FORBIDDEN', 'Not enrolled.');
          mySubmission = await AssignmentSubmission.findOne({
            assignmentId: assignment._id,
            studentId: userId,
          });
        } else if (role === 'faculty' && !facultyCanWrite(course, userId)) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }

        res.json({
          data: {
            assignment: toAssignmentDto(assignment),
            mySubmission: mySubmission ? toSubmissionDto(mySubmission) : null,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Faculty/admin PATCH — edit instructions, deadline, close/reopen.
  router.patch(
    '/:id',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');
        }
        const doc = await Assignment.findOne({ _id: id, deletedAt: null });
        if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');

        const course = await loadCourseOr404(doc.courseId.toString());
        const { role, userId } = req.auth!;
        if (role === 'faculty' && !facultyCanWrite(course, userId)) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }

        const body = UpdateAssignmentBody.parse(req.body);
        const before = doc.toObject();
        if (body.title !== undefined) doc.title = body.title.trim();
        if (body.instructions !== undefined) doc.instructions = body.instructions.trim();
        if (body.dueAt !== undefined) doc.dueAt = new Date(body.dueAt);
        if (body.maxScore !== undefined) doc.maxScore = body.maxScore;
        if (body.state !== undefined) doc.state = body.state;
        await doc.save();

        await recordAudit({
          actorUserId: userId,
          action: 'assignment.updated',
          targetType: 'Assignment',
          targetId: doc._id,
          before,
          after: doc.toObject(),
          ip: req.ip,
          ua: req.header('user-agent') ?? '',
        });

        res.json({ data: { assignment: toAssignmentDto(doc) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Student submits (or re-submits — upsert).
  router.post(
    '/:id/submissions',
    requireRole('student'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');
        }
        const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
        if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');
        if (assignment.state === 'closed') {
          throw new HttpError(409, 'ASSIGNMENT_CLOSED', 'Assignment is closed.');
        }

        const course = await loadCourseOr404(assignment.courseId.toString());
        const { userId } = req.auth!;
        const enrolled = await Enrollment.findOne({
          studentId: userId,
          courseId: course._id,
          status: 'active',
        });
        if (!enrolled) throw new HttpError(403, 'FORBIDDEN', 'Not enrolled.');

        const body = SubmitBody.parse(req.body);
        const text = (body.bodyText ?? '').trim();
        const url = body.attachmentUrl ?? null;
        if (!text && !url) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'Provide body text or an attachment URL.',
          );
        }

        const now = new Date();
        const sub = await AssignmentSubmission.findOneAndUpdate(
          { assignmentId: assignment._id, studentId: userId },
          {
            $set: {
              courseId: course._id,
              bodyText: text,
              attachmentUrl: url,
              submittedAt: now,
              // Clear previous grading when a student re-submits.
              score: null,
              feedback: null,
              gradedByUserId: null,
              gradedAt: null,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );

        await recordAudit({
          actorUserId: userId,
          action: 'assignment.submission.created',
          targetType: 'AssignmentSubmission',
          targetId: sub._id,
          after: sub.toObject(),
          details: {
            assignmentId: assignment._id.toString(),
            courseId: course._id.toString(),
          },
          ip: req.ip,
          ua: req.header('user-agent') ?? '',
        });

        // Notify the faculty assigned to the course.
        try {
          if (course.facultyIds.length > 0) {
            await enqueueNotification({
              type: 'assignment.submitted',
              recipients: course.facultyIds,
              title: `New submission: ${assignment.title}`,
              body: 'A student has submitted their work.',
              data: {
                assignmentId: assignment._id.toString(),
                submissionId: sub._id.toString(),
                studentId: userId.toString(),
              },
            });
          }
        } catch {
          // non-fatal
        }

        res.status(201).json({ data: { submission: toSubmissionDto(sub) } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Faculty lists every submission for an assignment.
  router.get(
    '/:id/submissions',
    requireRole('faculty', 'admin', 'superadmin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');
        }
        const assignment = await Assignment.findOne({ _id: id, deletedAt: null });
        if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');

        const course = await loadCourseOr404(assignment.courseId.toString());
        const { role, userId } = req.auth!;
        if (role === 'faculty' && !facultyCanWrite(course, userId)) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }

        const subs = await AssignmentSubmission.find({ assignmentId: assignment._id })
          .sort({ submittedAt: -1 })
          .limit(500);

        // Hydrate a small student lookup so the UI can show a name without
        // an extra round-trip.
        const studentIds = subs.map((s) => s.studentId);
        const students = await User.find({ _id: { $in: studentIds } })
          .select('_id name email code')
          .lean();
        const studentMap = new Map<string, { id: string; name: string; email: string; code: string | null }>();
        students.forEach((s) =>
          studentMap.set(s._id.toString(), {
            id: s._id.toString(),
            name: s.name as string,
            email: s.email as string,
            code: (s.code as string | null) ?? null,
          }),
        );

        res.json({
          data: {
            items: subs.map((s) => ({
              ...toSubmissionDto(s),
              student: studentMap.get(s.studentId.toString()) ?? null,
            })),
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Mounted at /v1/assignment-submissions. */
export function assignmentSubmissionsRouter(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireRole('faculty', 'admin', 'superadmin'));

  router.post(
    '/:id/grade',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id ?? '')) {
          throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');
        }
        const sub = await AssignmentSubmission.findById(id);
        if (!sub) throw new HttpError(404, 'NOT_FOUND', 'Submission not found.');

        const assignment = await Assignment.findOne({
          _id: sub.assignmentId,
          deletedAt: null,
        });
        if (!assignment) throw new HttpError(404, 'NOT_FOUND', 'Assignment not found.');

        const course = await loadCourseOr404(assignment.courseId.toString());
        const { role, userId } = req.auth!;
        if (role === 'faculty' && !facultyCanWrite(course, userId)) {
          throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
        }

        const body = GradeBody.parse(req.body);
        if (body.score > assignment.maxScore) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            `score exceeds maxScore (${assignment.maxScore}).`,
          );
        }
        const before = sub.toObject();
        sub.score = body.score;
        sub.feedback = body.feedback?.trim() || null;
        sub.gradedByUserId = userId;
        sub.gradedAt = new Date();
        await sub.save();

        await recordAudit({
          actorUserId: userId,
          action: 'assignment.submission.graded',
          targetType: 'AssignmentSubmission',
          targetId: sub._id,
          before,
          after: sub.toObject(),
          details: { assignmentId: assignment._id.toString() },
          ip: req.ip,
          ua: req.header('user-agent') ?? '',
        });

        try {
          await enqueueNotification({
            type: 'assignment.graded',
            recipients: [sub.studentId],
            title: `${assignment.title} graded`,
            body: `You scored ${sub.score} / ${assignment.maxScore}.`,
            data: {
              assignmentId: assignment._id.toString(),
              submissionId: sub._id.toString(),
            },
          });
        } catch {
          // non-fatal
        }

        res.json({ data: { submission: toSubmissionDto(sub) } });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
