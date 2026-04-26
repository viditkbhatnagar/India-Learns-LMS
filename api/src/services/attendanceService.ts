import { Types } from 'mongoose';
import { HttpError } from '../middleware/error.js';
import {
  AttendanceRecord,
  Enrollment,
  SessionModel,
  type AttendanceStatus,
  type HydratedAttendanceRecord,
} from '../models/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { recordAudit } from './auditService.js';
import { assertFacultyCanWriteCourse, assertFacultyOwnsCourse } from './authzService.js';

// Phase B-2 attendance:
//   - One AttendanceRecord per (sessionId, studentId).
//   - Idempotent upsert. Repeated marking overwrites — last write wins
//     (per OPEN-QUESTIONS.md co-teaching default).
//   - Faculty UI defaults each row to 'present' on first open. The DEFAULT
//     value lives only in the UI; the backend stores whatever it gets.

interface ActorCtx {
  ip?: string;
  ua?: string;
}

export interface AttendanceUpsertInput {
  studentId: string;
  status: AttendanceStatus;
}

export interface AttendanceRecordDto {
  id: string;
  sessionId: string;
  courseId: string;
  studentId: string;
  status: AttendanceStatus;
  markedBy: string;
  markedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function toAttendanceDto(doc: HydratedAttendanceRecord): AttendanceRecordDto {
  return {
    id: String(doc._id),
    sessionId: doc.sessionId.toString(),
    courseId: doc.courseId.toString(),
    studentId: doc.studentId.toString(),
    status: doc.status,
    markedBy: doc.markedBy.toString(),
    markedAt: doc.markedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function loadSessionForStaff(
  actor: AuthContext,
  sessionId: string,
): Promise<{ courseId: Types.ObjectId; sessionId: Types.ObjectId }> {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
  }
  const session = await SessionModel.findOne({ _id: sessionId, deletedAt: null })
    .select('_id courseId');
  if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
  await assertFacultyOwnsCourse(actor.userId, actor.role, session.courseId);
  return { sessionId: session._id, courseId: session.courseId };
}

/**
 * Bulk upsert attendance for a session. Each input row is an idempotent
 * upsert keyed on (sessionId, studentId). Students not currently enrolled
 * are silently skipped (returned as `skipped`) — faculty can take attendance
 * on a session where the roster has changed without erroring.
 */
export async function recordAttendance(
  actor: AuthContext,
  sessionIdStr: string,
  inputs: AttendanceUpsertInput[],
  ctx: ActorCtx,
): Promise<{ records: AttendanceRecordDto[]; skipped: string[] }> {
  const { sessionId, courseId } = await loadSessionForStaff(actor, sessionIdStr);
  // Oversight-mode admins/superadmins can read this session but cannot
  // record attendance unless they're on the course's faculty roster.
  await assertFacultyCanWriteCourse(actor.userId, actor.role, courseId);

  // Resolve enrolled students once so we can filter unknown ids.
  const enrolledIds = new Set(
    (await Enrollment.find({ courseId, status: 'active' }).select('studentId').lean()).map(
      (e) => e.studentId.toString(),
    ),
  );

  const skipped: string[] = [];
  const ops = inputs
    .filter((row) => {
      if (!Types.ObjectId.isValid(row.studentId)) {
        skipped.push(row.studentId);
        return false;
      }
      if (!enrolledIds.has(row.studentId)) {
        skipped.push(row.studentId);
        return false;
      }
      return true;
    })
    .map((row) => ({
      updateOne: {
        filter: {
          sessionId,
          studentId: new Types.ObjectId(row.studentId),
        },
        update: {
          $set: {
            sessionId,
            courseId,
            studentId: new Types.ObjectId(row.studentId),
            status: row.status,
            markedBy: actor.userId,
            markedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

  if (ops.length > 0) {
    await AttendanceRecord.bulkWrite(ops, { ordered: true });
  }

  // Re-read so the client gets the canonical persisted state.
  const records = await AttendanceRecord.find({ sessionId }).sort({ markedAt: -1 });
  await recordAudit({
    actorUserId: actor.userId,
    action: 'session.attendance.recorded',
    targetType: 'Session',
    targetId: sessionId,
    details: {
      courseId: courseId.toString(),
      processed: ops.length,
      skipped: skipped.length,
      // Don't dump the whole status payload — keeps audit rows compact.
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return { records: records.map(toAttendanceDto), skipped };
}

/** List attendance for a session — staff only. */
export async function listAttendance(
  actor: AuthContext,
  sessionIdStr: string,
): Promise<AttendanceRecordDto[]> {
  const { sessionId } = await loadSessionForStaff(actor, sessionIdStr);
  const docs = await AttendanceRecord.find({ sessionId }).sort({ markedAt: -1 });
  return docs.map(toAttendanceDto);
}
