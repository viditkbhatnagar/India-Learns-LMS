import { Types } from 'mongoose';
import type {
  MarkStaffAttendanceInput,
  Role,
  StaffAttendanceDto,
  StaffAttendanceStatus,
} from 'india-learns-shared-types';
import {
  StaffAttendance,
  User,
  type HydratedStaffAttendance,
} from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

// M10u — Staff attendance service. Faculty self-marks Present/Absent/etc.
// per day; admin can mark on behalf or override. One record per staff
// per UTC date; calling mark() a second time updates the existing row.

const STAFF_ROLES = new Set<Role>(['admin', 'superadmin', 'faculty']);

function toUtcMidnight(input: string | Date | undefined): Date {
  if (!input) {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!ymd) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'date must be YYYY-MM-DD.');
  }
  const [, yy, mm, dd] = ymd;
  return new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd)));
}

export async function toStaffAttendanceDto(
  doc: HydratedStaffAttendance,
): Promise<StaffAttendanceDto> {
  const json = doc.toObject();
  const [user, markedBy] = await Promise.all([
    User.findById(json.userId).select('name role'),
    User.findById(json.markedByUserId).select('name'),
  ]);
  const dateUtc = json.date instanceof Date ? json.date : new Date(json.date);
  return {
    id: String(json._id),
    userId: String(json.userId),
    userName: user?.name ?? '—',
    userRole: user?.role ?? '—',
    date: dateUtc.toISOString().slice(0, 10),
    status: json.status,
    notes: json.notes ?? null,
    markedByUserId: String(json.markedByUserId),
    markedByName: markedBy?.name ?? '—',
    markedAt: (json.markedAt as Date).toISOString(),
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

function actorCanMarkFor(
  actor: { role: Role; userId: Types.ObjectId },
  targetUserId: Types.ObjectId,
): void {
  if (actor.role === 'admin' || actor.role === 'superadmin') return;
  if (actor.role === 'faculty' && actor.userId.equals(targetUserId)) return;
  throw new HttpError(
    403,
    'FORBIDDEN',
    'Only admins may mark attendance for someone else; faculty can self-mark only.',
  );
}

export async function markStaffAttendance(
  input: MarkStaffAttendanceInput,
  actor: ActorContext & { actorUserId: Types.ObjectId; role: Role },
): Promise<HydratedStaffAttendance> {
  const targetUserId = input.userId
    ? new Types.ObjectId(input.userId)
    : actor.actorUserId;
  if (input.userId && !Types.ObjectId.isValid(input.userId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'userId is not a valid id.');
  }
  actorCanMarkFor({ role: actor.role, userId: actor.actorUserId }, targetUserId);

  const target = await User.findById(targetUserId).select('role status deletedAt');
  if (!target || target.deletedAt || target.status === 'revoked') {
    throw new HttpError(404, 'NOT_FOUND', 'Staff user not found.');
  }
  if (!STAFF_ROLES.has(target.role)) {
    throw new HttpError(
      422,
      'NOT_STAFF',
      'Attendance can only be marked for staff (admin / superadmin / faculty).',
    );
  }

  const date = toUtcMidnight(input.date);
  const before = await StaffAttendance.findOne({ userId: targetUserId, date });

  const doc = await StaffAttendance.findOneAndUpdate(
    { userId: targetUserId, date },
    {
      $set: {
        status: input.status,
        notes: input.notes?.trim() || null,
        markedByUserId: actor.actorUserId,
        markedAt: new Date(),
      },
      $setOnInsert: { userId: targetUserId, date },
    },
    { upsert: true, new: true, runValidators: true },
  );

  if (!doc) {
    throw new HttpError(500, 'INTERNAL', 'Failed to save attendance row.');
  }

  await recordAudit({
    actorUserId: actor.actorUserId,
    action: before ? 'staff_attendance.updated' : 'staff_attendance.marked',
    targetType: 'StaffAttendance',
    targetId: doc._id,
    before: before?.toObject() ?? null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function listStaffAttendance(query: {
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: StaffAttendanceStatus;
  page?: number;
  limit?: number;
}): Promise<{
  items: HydratedStaffAttendance[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const filter: Record<string, unknown> = {};
  if (query.userId && Types.ObjectId.isValid(query.userId)) {
    filter.userId = new Types.ObjectId(query.userId);
  }
  const dateRange: Record<string, Date> = {};
  if (query.dateFrom) dateRange.$gte = toUtcMidnight(query.dateFrom);
  if (query.dateTo) dateRange.$lte = toUtcMidnight(query.dateTo);
  if (Object.keys(dateRange).length > 0) filter.date = dateRange;
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    StaffAttendance.find(filter)
      .sort({ date: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    StaffAttendance.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function findStaffAttendanceForToday(
  userId: Types.ObjectId,
): Promise<HydratedStaffAttendance | null> {
  return StaffAttendance.findOne({
    userId,
    date: toUtcMidnight(undefined),
  });
}
