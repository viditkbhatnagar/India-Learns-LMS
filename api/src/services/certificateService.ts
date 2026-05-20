import { Types } from 'mongoose';
import type { CertificateDto } from 'india-learns-shared-types';
import {
  Course,
  Enrollment,
  User,
  type HydratedEnrollment,
} from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { getIntegrations } from '../integrations/index.js';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';
import { nowUtc } from './clockService.js';
import { recordAudit } from './auditService.js';
import { recordApiCost } from './apiCostService.js';
import {
  publishDomainEvent,
  registerListener,
} from './domainEventService.js';
import { enqueueNotification } from './notificationService.js';

// M8 — Certificate issuance service (TRD §6, PRD §13).
// * Idempotent: re-calling issueForEnrollment on an already-issued enrolment
//   returns the existing URL without touching the adapter.
// * Auto-issue path: listener on `course.completed` (see
//   registerCertificateListener) invokes this with actor='listener'.
// * Admin retry path: POST /v1/enrollments/:id/issue-certificate calls with
//   actor='admin' — used when the listener failed (PRD §13.2 "Retry button").
// * On adapter failure, error persists on the Enrollment (certificateIssueError)
//   so admins see it on the enrolment detail page, and we throw
//   INTEGRATION_FAILED (502).

export interface IssueForEnrollmentInput {
  enrollmentId: Types.ObjectId | string;
  actor: 'listener' | 'admin';
  actorUserId?: Types.ObjectId | null;
}

export interface IssueForEnrollmentResult {
  certificate: CertificateDto;
  reissued: boolean;
}

function toCertificateDto(
  enrolment: HydratedEnrollment,
  courseName: string,
): CertificateDto {
  return {
    enrollmentId: enrolment._id.toString(),
    studentId: enrolment.studentId.toString(),
    courseId: enrolment.courseId.toString(),
    courseName,
    programId: enrolment.programId.toString(),
    completedAt: (enrolment.completedAt ?? enrolment.updatedAt ?? new Date(0)).toISOString(),
    certificateUrl: enrolment.certificateUrl,
    providerId: enrolment.certificateProviderId,
    issuedAt: enrolment.certificateIssuedAt
      ? enrolment.certificateIssuedAt.toISOString()
      : null,
    issueError: enrolment.certificateIssueError,
  };
}

export async function issueForEnrollment(
  input: IssueForEnrollmentInput,
): Promise<IssueForEnrollmentResult> {
  const id = input.enrollmentId;
  if (typeof id === 'string' && !Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  }
  const enrolment = await Enrollment.findById(id);
  if (!enrolment) {
    throw new HttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrolment not found.');
  }
  if (!enrolment.completed) {
    throw new HttpError(
      409,
      'ENROLLMENT_NOT_COMPLETED',
      'Enrolment has not been marked completed.',
    );
  }
  const course = await Course.findById(enrolment.courseId);
  const student = await User.findById(enrolment.studentId);
  if (!course || !student) {
    throw new HttpError(500, 'INTERNAL', 'Enrolment references missing course or student.');
  }

  // Idempotent short-circuit: if already issued, return existing row.
  if (enrolment.certificateUrl) {
    if (input.actor === 'admin') {
      await recordAudit({
        actorUserId: input.actorUserId ?? null,
        action: 'certificate.reissue_attempted',
        targetType: 'Enrollment',
        targetId: enrolment._id,
        details: {
          certificateUrl: enrolment.certificateUrl,
          providerId: enrolment.certificateProviderId,
        },
      });
    }
    return {
      certificate: toCertificateDto(enrolment, course.name),
      reissued: true,
    };
  }

  const env = loadEnv();
  const templateId = course.certificateTemplateId ?? env.CERTIFIER_DEFAULT_TEMPLATE_ID;
  const { certificate: adapter } = getIntegrations();
  try {
    const result = await adapter.issue({
      studentName: student.name,
      email: student.email,
      courseName: course.name,
      completionDate: enrolment.completedAt ?? nowUtc(),
      templateId,
      idempotencyKey: enrolment._id.toString(),
    });
    enrolment.certificateUrl = result.certificateUrl;
    enrolment.certificateProviderId = result.providerId;
    enrolment.certificateIssuedAt = nowUtc();
    enrolment.certificateIssueError = null;
    await enrolment.save();

    await recordApiCost({
      provider: 'certifier',
      operation: 'certifier.issue',
      refType: 'Enrollment',
      refId: enrolment._id,
    });

    await recordAudit({
      actorUserId: input.actorUserId ?? null,
      action: 'certificate.issued',
      targetType: 'Enrollment',
      targetId: enrolment._id,
      details: {
        actor: input.actor,
        providerId: result.providerId,
        certificateUrl: result.certificateUrl,
        courseName: course.name,
      },
    });

    // Notify the student — email + in-app per PRD §14.3.
    await enqueueNotification({
      type: 'certificate.issued',
      recipients: [enrolment.studentId],
      title: `Congratulations! Your ${course.name} certificate is ready.`,
      body: `You've completed ${course.name}. Download your certificate: ${result.certificateUrl}`,
      data: {
        enrolmentId: enrolment._id.toString(),
        courseId: enrolment.courseId.toString(),
        courseName: course.name,
        certificateUrl: result.certificateUrl,
      },
    });

    // Publish domain event so downstream consumers (analytics, CSV exports)
    // can react. Persisted via DomainEvent collection.
    await publishDomainEvent('certificate.issued', {
      enrolmentId: enrolment._id.toString(),
      studentId: enrolment.studentId.toString(),
      courseId: enrolment.courseId.toString(),
      certificateUrl: result.certificateUrl,
      providerId: result.providerId,
    });

    return {
      certificate: toCertificateDto(enrolment, course.name),
      reissued: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    enrolment.certificateIssueError = message.slice(0, 500);
    await enrolment.save();
    await recordAudit({
      actorUserId: input.actorUserId ?? null,
      action: 'certificate.issue_failed',
      targetType: 'Enrollment',
      targetId: enrolment._id,
      details: { actor: input.actor, error: message.slice(0, 500) },
    });
    logger.warn(
      { err, enrolmentId: enrolment._id.toString(), actor: input.actor },
      'certificate.issue_failed',
    );
    throw new HttpError(
      502,
      'INTEGRATION_FAILED',
      'Certifier integration failed. Please retry.',
      { hint: message.slice(0, 200) },
    );
  }
}

export async function listCertificatesForStudent(
  studentId: Types.ObjectId,
): Promise<CertificateDto[]> {
  const enrolments = await Enrollment.find({
    studentId,
    completed: true,
  }).sort({ certificateIssuedAt: -1, completedAt: -1 });
  if (enrolments.length === 0) return [];
  const courseIds = enrolments.map((e) => e.courseId);
  const courses = await Course.find({ _id: { $in: courseIds } }).select('name');
  const courseNameById = new Map<string, string>();
  courses.forEach((c) => courseNameById.set(c._id.toString(), c.name));
  return enrolments.map((e) =>
    toCertificateDto(e, courseNameById.get(e.courseId.toString()) ?? 'Course'),
  );
}

export async function countIssuedCertificatesForStudent(
  studentId: Types.ObjectId,
): Promise<{ count: number; latestIssuedAt: Date | null }> {
  const rows = await Enrollment.find({
    studentId,
    certificateUrl: { $ne: null },
  })
    .select('certificateIssuedAt')
    .sort({ certificateIssuedAt: -1 })
    .limit(1);
  const count = await Enrollment.countDocuments({
    studentId,
    certificateUrl: { $ne: null },
  });
  return {
    count,
    latestIssuedAt: rows[0]?.certificateIssuedAt ?? null,
  };
}

// Listener wiring — exported so app bootstrap + tests can control registration.
// We guard against double-registration because app reload in watch-mode or
// repeated `registerCertificateListener()` calls in tests would otherwise
// stack listeners and cause N certificate-issue attempts per event.
let listenerRegistered = false;

export function registerCertificateListener(): void {
  if (listenerRegistered) return;
  registerListener('course.completed', async (payload) => {
    const enrolmentId = payload.enrolmentId as string | undefined;
    if (!enrolmentId) return;
    try {
      await issueForEnrollment({ enrollmentId: enrolmentId, actor: 'listener' });
    } catch (err) {
      // Failure is already persisted on the enrolment + audited; admin will
      // see it on the enrolment detail page and can POST to retry.
      logger.warn(
        { err, enrolmentId },
        'certificate.listener.issue_failed',
      );
    }
  });

  // M10s — Admin notification on course completion. Logan 2026-05-20:
  // "Receives notifications when students complete a course." Sits next
  // to the certificate listener so both fire from the same domain event;
  // failure here MUST NOT block certificate issuance.
  registerListener('course.completed', async (payload) => {
    try {
      const enrolmentId = payload.enrolmentId as string | undefined;
      const studentId = payload.studentId as string | undefined;
      const courseId = payload.courseId as string | undefined;
      if (!enrolmentId || !studentId || !courseId) return;
      const [student, course, admins] = await Promise.all([
        User.findById(studentId).select('name email code'),
        Course.findById(courseId).select('name'),
        User.find({
          role: { $in: ['admin', 'superadmin'] },
          status: 'active',
          deletedAt: null,
        }).select('_id'),
      ]);
      if (!student || !course || admins.length === 0) return;
      const studentLabel = student.code ? `${student.name} (${student.code})` : student.name;
      await enqueueNotification({
        type: 'student.course_completed',
        title: `${studentLabel} completed ${course.name}`,
        body:
          `${studentLabel} just finished the ${course.name} course. ` +
          'A certificate is being issued; you can verify on the enrolment page.',
        recipients: admins.map((a) => a._id),
        data: {
          enrolmentId,
          studentId,
          courseId,
        },
      });
    } catch (err) {
      logger.warn({ err, payload }, 'course.completed.admin_notify_failed');
    }
  });

  listenerRegistered = true;
}

/** Test-only — reset the single-flight guard. */
export function resetCertificateListenerRegistration(): void {
  listenerRegistered = false;
}
