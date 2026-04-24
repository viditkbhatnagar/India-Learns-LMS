import { Types } from 'mongoose';
import type {
  CreateTimetableOverrideInput,
  Role,
  TimetableOverrideDto,
  UpdateTimetableOverrideInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  Course,
  TimetableEntry,
  TimetableOverride,
  User,
  type HydratedTimetableEntry,
  type HydratedTimetableOverride,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { facultyAssignedToCourse, findCourseById } from './courseService.js';
import { notifyTimetableChange } from './notificationService.js';
import { istDateStringFromUtc, utcDateForIstDay } from './timetableTz.js';
import type { ActorContext } from './userService.js';

function requireId(id: string, label = 'record'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Only admins may ${verb} timetable overrides.`,
    );
  }
}

export function toTimetableOverrideDto(
  doc: HydratedTimetableOverride,
): TimetableOverrideDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string | null => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return null;
  };
  return {
    id: String(json.id),
    batchId: doc.batchId.toString(),
    entryId: doc.entryId?.toString() ?? null,
    date: istDateStringFromUtc(doc.date),
    action: doc.action,
    newCourseId: doc.newCourseId?.toString() ?? null,
    newFacultyId: doc.newFacultyId?.toString() ?? null,
    newStartMinutes: doc.newStartMinutes,
    newEndMinutes: doc.newEndMinutes,
    newRoom: doc.newRoom,
    reason: doc.reason ?? '',
    createdAt: iso(json.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(json.updatedAt) ?? new Date(0).toISOString(),
  };
}

function assertIstDate(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Override date must be a YYYY-MM-DD IST calendar day.',
    );
  }
  return utcDateForIstDay(ymd);
}

async function validateCancel(
  batchId: Types.ObjectId,
  entryId: Types.ObjectId | null,
): Promise<{
  entry: HydratedTimetableEntry;
  courseName: string;
  originalFacultyId: Types.ObjectId;
}> {
  if (!entryId) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'cancel overrides require entryId.',
    );
  }
  const entry = await TimetableEntry.findOne({ _id: entryId, deletedAt: null });
  if (!entry) throw new HttpError(404, 'NOT_FOUND', 'Timetable entry not found.');
  if (!entry.batchId.equals(batchId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Timetable entry does not belong to the specified batch.',
    );
  }
  const course = await Course.findOne({ _id: entry.courseId });
  return {
    entry,
    courseName: course?.name ?? 'Class',
    originalFacultyId: entry.facultyId,
  };
}

async function validateReschedule(
  batchId: Types.ObjectId,
  entryId: Types.ObjectId | null,
  input: CreateTimetableOverrideInput | UpdateTimetableOverrideInput,
): Promise<{
  entry: HydratedTimetableEntry;
  courseName: string;
  originalFacultyId: Types.ObjectId;
  newFacultyId: Types.ObjectId | null;
}> {
  const validated = await validateCancel(batchId, entryId);
  const {
    newCourseId,
    newFacultyId,
    newStartMinutes,
    newEndMinutes,
  } = input;

  const hasAny =
    newCourseId !== undefined && newCourseId !== null
      || (newFacultyId !== undefined && newFacultyId !== null)
      || (newStartMinutes !== undefined && newStartMinutes !== null)
      || (newEndMinutes !== undefined && newEndMinutes !== null);
  if (!hasAny) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'reschedule overrides require at least one of newCourseId, newFacultyId, newStartMinutes, newEndMinutes.',
    );
  }

  if (
    (newStartMinutes !== null && newStartMinutes !== undefined)
    || (newEndMinutes !== null && newEndMinutes !== undefined)
  ) {
    const start = newStartMinutes ?? validated.entry.startTimeMinutes;
    const end = newEndMinutes ?? validated.entry.endTimeMinutes;
    if (start < 0 || end > 1440 || end <= start) {
      throw new HttpError(400, 'INVALID_TIME_RANGE', 'Invalid override time window.');
    }
  }

  const courseId = newCourseId
    ? requireId(newCourseId, 'Course')
    : validated.entry.courseId;
  const facultyId = newFacultyId
    ? requireId(newFacultyId, 'Faculty')
    : validated.entry.facultyId;

  const course = await findCourseById(courseId.toString());
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  const faculty = await User.findOne({
    _id: facultyId,
    role: 'faculty',
    deletedAt: null,
  });
  if (!faculty) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'facultyId must reference an active faculty user.');
  }
  if (!facultyAssignedToCourse(course, facultyId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Faculty is not assigned to this course.',
    );
  }

  return {
    entry: validated.entry,
    courseName: course.name,
    originalFacultyId: validated.entry.facultyId,
    newFacultyId: newFacultyId ? facultyId : null,
  };
}

async function validateAdd(
  batchId: Types.ObjectId,
  input: CreateTimetableOverrideInput | UpdateTimetableOverrideInput,
): Promise<{ courseName: string; newFacultyId: Types.ObjectId }> {
  const { newCourseId, newFacultyId, newStartMinutes, newEndMinutes } = input;
  if (!newCourseId || !newFacultyId || newStartMinutes == null || newEndMinutes == null) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'add overrides require newCourseId, newFacultyId, newStartMinutes, newEndMinutes.',
    );
  }
  if (newStartMinutes < 0 || newEndMinutes > 1440 || newEndMinutes <= newStartMinutes) {
    throw new HttpError(400, 'INVALID_TIME_RANGE', 'Invalid override time window.');
  }
  const courseId = requireId(newCourseId, 'Course');
  const facultyId = requireId(newFacultyId, 'Faculty');
  const [course, faculty, batch] = await Promise.all([
    findCourseById(courseId.toString()),
    User.findOne({ _id: facultyId, role: 'faculty', deletedAt: null }),
    Batch.findOne({ _id: batchId, deletedAt: null }),
  ]);
  if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
  if (!faculty) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'facultyId must reference an active faculty user.');
  }
  if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  if (!course.programId.equals(batch.programId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Course does not belong to the batch\'s program.',
    );
  }
  if (!facultyAssignedToCourse(course, facultyId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Faculty is not assigned to this course.',
    );
  }
  return { courseName: course.name, newFacultyId: facultyId };
}

export async function listOverridesInRange(
  batchId: Types.ObjectId,
  fromIstYmd: string,
  toIstYmd: string,
): Promise<HydratedTimetableOverride[]> {
  const fromUtc = utcDateForIstDay(fromIstYmd);
  const toUtc = utcDateForIstDay(toIstYmd);
  const toUtcInclusive = new Date(toUtc.getTime() + 86_399_999);
  return TimetableOverride.find({
    batchId,
    date: { $gte: fromUtc, $lte: toUtcInclusive },
  }).sort({ date: 1 });
}

export async function createOverride(
  input: CreateTimetableOverrideInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableOverride> {
  assertAdmin(actor.role, 'create');
  const batchId = requireId(input.batchId, 'Batch');
  const batch = await Batch.findOne({ _id: batchId, deletedAt: null });
  if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');

  const date = assertIstDate(input.date);
  const istDate = input.date;

  let entryId: Types.ObjectId | null = null;
  let originalFacultyId: Types.ObjectId | null = null;
  let newFacultyId: Types.ObjectId | null = null;
  let courseName = '';

  if (input.action === 'cancel') {
    if (!input.entryId) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'cancel overrides require entryId.',
      );
    }
    entryId = requireId(input.entryId, 'Timetable entry');
    const validated = await validateCancel(batchId, entryId);
    originalFacultyId = validated.originalFacultyId;
    courseName = validated.courseName;
  } else if (input.action === 'reschedule') {
    if (!input.entryId) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'reschedule overrides require entryId.',
      );
    }
    entryId = requireId(input.entryId, 'Timetable entry');
    const validated = await validateReschedule(batchId, entryId, input);
    originalFacultyId = validated.originalFacultyId;
    newFacultyId = validated.newFacultyId;
    courseName = validated.courseName;
  } else if (input.action === 'add') {
    if (input.entryId != null) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'add overrides must not carry an entryId.',
      );
    }
    const validated = await validateAdd(batchId, input);
    courseName = validated.courseName;
    newFacultyId = validated.newFacultyId;
  }

  const doc = await TimetableOverride.create({
    batchId,
    entryId,
    date,
    action: input.action,
    newCourseId: input.newCourseId ? requireId(input.newCourseId, 'Course') : null,
    newFacultyId: input.newFacultyId ? requireId(input.newFacultyId, 'Faculty') : null,
    newStartMinutes: input.newStartMinutes ?? null,
    newEndMinutes: input.newEndMinutes ?? null,
    newRoom: input.newRoom ?? null,
    reason: (input.reason ?? '').trim(),
  });

  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.override.created',
    targetType: 'TimetableOverride',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });

  await notifyTimetableChange({
    batchId,
    action: input.action,
    overrideId: doc._id,
    date,
    istDate,
    entryId,
    newFacultyId,
    originalFacultyId,
    batchName: batch.name,
    courseName,
    reason: doc.reason,
  });

  return doc;
}

export async function updateOverride(
  id: string,
  patch: UpdateTimetableOverrideInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableOverride> {
  assertAdmin(actor.role, 'update');
  const overrideId = requireId(id, 'Timetable override');
  const doc = await TimetableOverride.findById(overrideId);
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'Timetable override not found.');
  }
  const before = doc.toObject();
  const batch = await Batch.findOne({ _id: doc.batchId, deletedAt: null });
  if (!batch) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');

  // Action is immutable (simpler semantics). Validate patch against the
  // current action's rules.
  if (patch.action !== undefined && patch.action !== doc.action) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Override action cannot change; delete and recreate instead.',
    );
  }

  if (patch.newCourseId !== undefined) {
    doc.newCourseId = patch.newCourseId
      ? requireId(patch.newCourseId, 'Course')
      : null;
  }
  if (patch.newFacultyId !== undefined) {
    doc.newFacultyId = patch.newFacultyId
      ? requireId(patch.newFacultyId, 'Faculty')
      : null;
  }
  if (patch.newStartMinutes !== undefined) doc.newStartMinutes = patch.newStartMinutes;
  if (patch.newEndMinutes !== undefined) doc.newEndMinutes = patch.newEndMinutes;
  if (patch.newRoom !== undefined) doc.newRoom = patch.newRoom;
  if (patch.reason !== undefined) doc.reason = patch.reason.trim();

  let originalFacultyId: Types.ObjectId | null = null;
  let newFacultyId: Types.ObjectId | null = null;
  let courseName = '';

  if (doc.action === 'cancel') {
    const v = await validateCancel(doc.batchId, doc.entryId);
    originalFacultyId = v.originalFacultyId;
    courseName = v.courseName;
  } else if (doc.action === 'reschedule') {
    const v = await validateReschedule(doc.batchId, doc.entryId, {
      newCourseId: doc.newCourseId?.toString() ?? null,
      newFacultyId: doc.newFacultyId?.toString() ?? null,
      newStartMinutes: doc.newStartMinutes,
      newEndMinutes: doc.newEndMinutes,
      newRoom: doc.newRoom,
      reason: doc.reason,
    });
    originalFacultyId = v.originalFacultyId;
    newFacultyId = v.newFacultyId;
    courseName = v.courseName;
  } else if (doc.action === 'add') {
    const v = await validateAdd(doc.batchId, {
      batchId: doc.batchId.toString(),
      action: 'add',
      date: istDateStringFromUtc(doc.date),
      newCourseId: doc.newCourseId?.toString() ?? null,
      newFacultyId: doc.newFacultyId?.toString() ?? null,
      newStartMinutes: doc.newStartMinutes,
      newEndMinutes: doc.newEndMinutes,
    });
    courseName = v.courseName;
    newFacultyId = v.newFacultyId;
  }

  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.override.updated',
    targetType: 'TimetableOverride',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });

  await notifyTimetableChange({
    batchId: doc.batchId,
    action: 'updated',
    overrideId: doc._id,
    date: doc.date,
    istDate: istDateStringFromUtc(doc.date),
    entryId: doc.entryId,
    newFacultyId,
    originalFacultyId,
    batchName: batch.name,
    courseName,
    reason: doc.reason,
  });

  return doc;
}

export async function deleteOverride(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedTimetableOverride> {
  assertAdmin(actor.role, 'delete');
  const overrideId = requireId(id, 'Timetable override');
  const doc = await TimetableOverride.findById(overrideId);
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND', 'Timetable override not found.');
  }
  const before = doc.toObject();
  const batch = await Batch.findOne({ _id: doc.batchId });

  // Look up course name + original faculty before the doc goes away.
  let courseName = 'Class';
  let originalFacultyId: Types.ObjectId | null = null;
  if (doc.entryId) {
    const entry = await TimetableEntry.findOne({ _id: doc.entryId });
    if (entry) {
      originalFacultyId = entry.facultyId;
      const course = await Course.findOne({ _id: entry.courseId });
      if (course) courseName = course.name;
    }
  } else if (doc.newCourseId) {
    const course = await Course.findOne({ _id: doc.newCourseId });
    if (course) courseName = course.name;
  }
  const newFacultyId = doc.newFacultyId ?? null;
  const { batchId, date } = doc;

  await doc.deleteOne();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'timetable.override.deleted',
    targetType: 'TimetableOverride',
    targetId: overrideId,
    before,
    after: null,
    ip: actor.ip,
    ua: actor.ua,
  });

  if (batch) {
    await notifyTimetableChange({
      batchId,
      action: 'deleted',
      overrideId,
      date,
      istDate: istDateStringFromUtc(date),
      entryId: doc.entryId,
      newFacultyId,
      originalFacultyId,
      batchName: batch.name,
      courseName,
      reason: doc.reason,
    });
  }

  return doc;
}
