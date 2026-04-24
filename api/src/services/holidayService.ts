import { Types } from 'mongoose';
import type {
  CreateHolidayInput,
  HolidayDto,
  Role,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import { Holiday, type HydratedHoliday } from '../models/index.js';
import { recordAudit } from './auditService.js';
import { utcDateForIstDay } from './timetableTz.js';
import type { ActorContext } from './userService.js';

function assertAdmin(role: Role, verb: string): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', `Only admins may ${verb} holidays.`);
  }
}

export function toHolidayDto(doc: HydratedHoliday): HolidayDto {
  const json = doc.toJSON() as Record<string, unknown>;
  const iso = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return new Date(0).toISOString();
  };
  return {
    id: String(json.id),
    date: iso(json.date),
    name: doc.name,
    kind: doc.kind,
    createdAt: iso(json.createdAt),
    updatedAt: iso(json.updatedAt),
  };
}

export async function listHolidaysInRange(
  fromIstYmd: string,
  toIstYmd: string,
): Promise<HydratedHoliday[]> {
  const fromUtc = utcDateForIstDay(fromIstYmd);
  const toUtc = utcDateForIstDay(toIstYmd);
  // Toggle to inclusive end: add one day minus 1 ms.
  const toUtcInclusive = new Date(toUtc.getTime() + 86_399_999);
  return Holiday.find({
    date: { $gte: fromUtc, $lte: toUtcInclusive },
  }).sort({ date: 1 });
}

export async function listHolidaysByIstDates(
  istDates: string[],
): Promise<Map<string, HydratedHoliday>> {
  if (istDates.length === 0) return new Map();
  const dates = istDates.map((d) => utcDateForIstDay(d));
  const docs = await Holiday.find({ date: { $in: dates } });
  const map = new Map<string, HydratedHoliday>();
  docs.forEach((doc) => {
    // Stored value is the UTC instant of IST-midnight (-05:30 from the IST
    // calendar day). Shift forward by +05:30 to recover the IST YMD key.
    const istDayMs = doc.date.getTime() + 330 * 60_000;
    const istDay = new Date(istDayMs).toISOString().slice(0, 10);
    map.set(istDay, doc);
  });
  return map;
}

export async function createHoliday(
  input: CreateHolidayInput,
  actor: { role: Role } & ActorContext,
): Promise<HydratedHoliday> {
  assertAdmin(actor.role, 'create');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
  if (!match) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Holiday date must be a YYYY-MM-DD IST calendar day.',
    );
  }
  const date = utcDateForIstDay(input.date);
  const existing = await Holiday.findOne({ date });
  if (existing) {
    throw new HttpError(409, 'HOLIDAY_DUPLICATE', 'A holiday already exists on this date.');
  }
  const doc = await Holiday.create({
    date,
    name: input.name.trim(),
    kind: input.kind ?? 'public',
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'holiday.created',
    targetType: 'Holiday',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function deleteHoliday(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<HydratedHoliday> {
  assertAdmin(actor.role, 'delete');
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Holiday not found.');
  }
  const doc = await Holiday.findById(id);
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Holiday not found.');
  const before = doc.toObject();
  await doc.deleteOne();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'holiday.deleted',
    targetType: 'Holiday',
    targetId: doc._id,
    before,
    after: null,
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
