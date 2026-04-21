import { Types } from 'mongoose';
import type {
  CreateEnrollmentInput,
  EnrollmentDto,
  EnrollmentStatus,
  Role,
  UpdateEnrollmentInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  Course,
  Enrollment,
  Program,
  User,
  type HydratedEnrollment,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

function requireId(id: string, label = 'record'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

function toDto(doc: HydratedEnrollment): EnrollmentDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id: String(json.id),
    studentId: doc.studentId.toString(),
    batchId: doc.batchId.toString(),
    courseId: doc.courseId.toString(),
    programId: doc.programId.toString(),
    validFrom: iso(json.validFrom) ?? new Date(0).toISOString(),
    validTo: iso(json.validTo) ?? new Date(0).toISOString(),
    status: json.status as EnrollmentDto['status'],
    accessState: json.accessState as EnrollmentDto['accessState'],
    completed: Boolean(json.completed),
    completedAt: iso(json.completedAt),
    certificateUrl: (json.certificateUrl as string | null) ?? null,
    certificateIssuedAt: iso(json.certificateIssuedAt),
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
  };
}

export { toDto as toEnrollmentDto };

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', `Only admins may ${verb} enrolments.`);
  }
}

export async function enrolStudentInProgram(
  input: CreateEnrollmentInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedEnrollment[]> {
  assertAdmin(actor.role, 'create');
  const studentId = requireId(input.studentId, 'Student');
  const programId = requireId(input.programId, 'Program');
  const batchId = requireId(input.batchId, 'Batch');

  const [student, program, batch] = await Promise.all([
    User.findOne({ _id: studentId, deletedAt: null }),
    Program.findOne({ _id: programId, deletedAt: null }),
    Batch.findOne({ _id: batchId, deletedAt: null }),
  ]);
  if (!student || student.role !== 'student') {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  if (!batch.programId.equals(program._id)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Batch does not belong to the requested program.',
    );
  }

  const validFrom = new Date(input.validFrom);
  const validTo = new Date(input.validTo);
  if (Number.isNaN(validFrom.valueOf()) || Number.isNaN(validTo.valueOf())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid validFrom or validTo.');
  }
  if (validTo <= validFrom) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'validTo must be after validFrom.');
  }

  const courses = await Course.find({ programId: program._id, deletedAt: null });
  if (courses.length === 0) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Program has no courses to enrol into.',
    );
  }

  const courseIds = courses.map((c) => c._id);
  const existing = await Enrollment.findOne({
    studentId: student._id,
    courseId: { $in: courseIds },
    status: 'active',
  });
  if (existing) {
    throw new HttpError(
      409,
      'ENROLLMENT_DUPLICATE',
      'Student already has an active enrolment on a course in this program.',
    );
  }

  const activeInBatch = await Enrollment.aggregate<{ _id: Types.ObjectId }>([
    { $match: { batchId: batch._id, status: 'active' } },
    { $group: { _id: '$studentId' } },
  ]);
  const uniqueStudents = new Set(activeInBatch.map((r) => String(r._id)));
  if (!uniqueStudents.has(String(student._id)) && uniqueStudents.size >= batch.capacity) {
    throw new HttpError(409, 'BATCH_FULL', 'Batch has reached its capacity.');
  }

  const created = await Promise.all(
    courses.map((course) =>
      Enrollment.create({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
        validFrom,
        validTo,
        status: 'active',
        accessState: 'active',
      }),
    ),
  );
  await Promise.all(
    created.map((doc) =>
      recordAudit({
        actorUserId: actor.actorUserId,
        action: 'enrollment.created',
        targetType: 'Enrollment',
        targetId: doc._id,
        before: null,
        after: doc.toObject(),
        ip: actor.ip,
        ua: actor.ua,
      }),
    ),
  );

  // Keep the User record loosely in sync — student dashboards read programId/batchId.
  student.programId = program._id;
  student.batchId = batch._id;
  student.enrolmentValidFrom = validFrom;
  student.enrolmentValidTo = validTo;
  await student.save();

  return created;
}

export async function listEnrollments(query: {
  studentId?: string;
  batchId?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  page?: number;
  limit?: number;
}): Promise<{ items: HydratedEnrollment[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const filter: Record<string, unknown> = {};
  if (query.studentId && Types.ObjectId.isValid(query.studentId)) {
    filter.studentId = new Types.ObjectId(query.studentId);
  }
  if (query.batchId && Types.ObjectId.isValid(query.batchId)) {
    filter.batchId = new Types.ObjectId(query.batchId);
  }
  if (query.courseId && Types.ObjectId.isValid(query.courseId)) {
    filter.courseId = new Types.ObjectId(query.courseId);
  }
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Enrollment.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function listEnrollmentsForStudent(
  studentId: Types.ObjectId,
): Promise<HydratedEnrollment[]> {
  return Enrollment.find({ studentId }).sort({ createdAt: -1 });
}

export async function updateEnrollment(
  id: string,
  patch: UpdateEnrollmentInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedEnrollment> {
  assertAdmin(actor.role, 'update');
  const doc = await Enrollment.findById(requireId(id, 'Enrolment'));
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Enrolment not found.');
  const before = doc.toObject();
  const action: 'enrollment.updated' | 'enrollment.revoked' =
    patch.status === 'revoked' ? 'enrollment.revoked' : 'enrollment.updated';

  if (patch.batchId !== undefined) {
    const batchId = requireId(patch.batchId, 'Batch');
    const batch = await Batch.findOne({ _id: batchId, deletedAt: null });
    if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
    if (!batch.programId.equals(doc.programId)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'Batch does not belong to the enrolment\'s program.',
      );
    }
    doc.batchId = batchId;
  }
  if (patch.validTo !== undefined) {
    const d = new Date(patch.validTo);
    if (Number.isNaN(d.valueOf())) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid validTo.');
    }
    if (d <= doc.validFrom) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'validTo must be after validFrom.');
    }
    doc.validTo = d;
  }
  if (patch.completed !== undefined) {
    doc.completed = patch.completed;
    doc.completedAt = patch.completed ? new Date() : null;
  }
  if (patch.status === 'revoked') {
    doc.status = 'revoked';
  }
  if (patch.accessState !== undefined) {
    doc.accessState = patch.accessState;
  }
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action,
    targetType: 'Enrollment',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
