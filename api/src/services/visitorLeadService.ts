import { Types } from 'mongoose';
import type {
  CreateVisitorLeadInput,
  UpdateVisitorLeadInput,
  VisitorLeadDto,
  VisitorLeadSource,
  VisitorLeadStatus,
  VisitorOtpStatus,
  VisitorQualification,
} from 'india-learns-shared-types';
import { VisitorLead, type HydratedVisitorLead } from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';
import type { PersonalAddressDoc } from '../models/user.js';

// M10s — Visitor Lead service. Admin-only writes; service-layer
// validation + audit trail. Convert flow creates an ApplicationDraft
// prefilled from the lead and links them via convertedApplicationId.

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function isoYmd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDto(doc: HydratedVisitorLead): VisitorLeadDto {
  const json = doc.toObject();
  return {
    id: String(json._id),
    firstName: json.firstName,
    lastName: json.lastName,
    highestQualification: (json.highestQualification ?? null) as VisitorQualification | null,
    dateOfBirth: isoYmd(json.dateOfBirth),
    currentAddress: json.currentAddress
      ? {
          street: json.currentAddress.street,
          city: json.currentAddress.city,
          stateProvince: json.currentAddress.stateProvince,
          postalCode: json.currentAddress.postalCode,
          country: json.currentAddress.country,
        }
      : null,
    phoneE164: json.phoneE164,
    email: json.email ?? null,
    parentGuardianContact: json.parentGuardianContact ?? null,
    leadSource: json.leadSource,
    socialMediaId: json.socialMediaId ?? null,
    otpVerificationStatus: json.otpVerificationStatus,
    status: json.status,
    notes: json.notes ?? null,
    assignedToUserId: json.assignedToUserId ? String(json.assignedToUserId) : null,
    convertedApplicationId: json.convertedApplicationId
      ? String(json.convertedApplicationId)
      : null,
    createdByUserId: String(json.createdByUserId),
    createdAt: isoDate(json.createdAt as Date) ?? new Date(0).toISOString(),
    updatedAt: isoDate(json.updatedAt as Date) ?? new Date(0).toISOString(),
    deletedAt: isoDate(json.deletedAt),
  };
}

export { toDto as toVisitorLeadDto };

function requireId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', 'Visitor lead not found.');
  }
  return new Types.ObjectId(id);
}

function parseDob(input: string | null | undefined): Date | null {
  if (!input) return null;
  // Accept YYYY-MM-DD or full ISO. Strip time-of-day so the DOB is date-only.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!ymd) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'dateOfBirth must be YYYY-MM-DD.');
  }
  const [, yy, mm, dd] = ymd;
  const d = new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd)));
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'dateOfBirth is not a valid date.');
  }
  return d;
}

function normalizeAddress(
  input: CreateVisitorLeadInput['currentAddress'],
): PersonalAddressDoc | null {
  if (!input) return null;
  return {
    street: input.street?.trim() ?? '',
    city: input.city?.trim() ?? '',
    stateProvince: input.stateProvince?.trim() ?? '',
    postalCode: input.postalCode?.trim() ?? '',
    country: input.country?.trim() || 'India',
  };
}

export async function createVisitorLead(
  input: CreateVisitorLeadInput,
  actor: ActorContext & { actorUserId: Types.ObjectId },
): Promise<HydratedVisitorLead> {
  // Reject duplicate phone (active leads only — soft-deleted entries
  // free the unique index per the partialFilterExpression).
  const existing = await VisitorLead.findOne({
    phoneE164: input.phoneE164,
    deletedAt: null,
  });
  if (existing) {
    throw new HttpError(
      409,
      'LEAD_EXISTS',
      'A visitor lead with this phone number already exists.',
    );
  }
  const doc = await VisitorLead.create({
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    highestQualification: input.highestQualification ?? null,
    dateOfBirth: parseDob(input.dateOfBirth ?? null),
    currentAddress: normalizeAddress(input.currentAddress ?? null),
    phoneE164: input.phoneE164,
    email: input.email?.trim().toLowerCase() || null,
    parentGuardianContact: input.parentGuardianContact?.trim() || null,
    leadSource: input.leadSource,
    socialMediaId: input.socialMediaId?.trim() || null,
    otpVerificationStatus: input.otpVerificationStatus ?? 'pending',
    status: input.status ?? 'new',
    notes: input.notes?.trim() || null,
    assignedToUserId:
      input.assignedToUserId && Types.ObjectId.isValid(input.assignedToUserId)
        ? new Types.ObjectId(input.assignedToUserId)
        : null,
    createdByUserId: actor.actorUserId,
  });
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'visitor_lead.created',
    targetType: 'VisitorLead',
    targetId: doc._id,
    before: null,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function listVisitorLeads(query: {
  status?: VisitorLeadStatus;
  leadSource?: VisitorLeadSource;
  otpStatus?: VisitorOtpStatus;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: HydratedVisitorLead[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.leadSource) filter.leadSource = query.leadSource;
  if (query.otpStatus) filter.otpVerificationStatus = query.otpStatus;
  if (query.q && query.q.trim()) {
    const safe = query.q.trim().replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(safe, 'i');
    filter.$or = [
      { firstName: re },
      { lastName: re },
      { email: re },
      { phoneE164: re },
      { socialMediaId: re },
    ];
  }
  const [items, total] = await Promise.all([
    VisitorLead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    VisitorLead.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function findVisitorLeadById(id: string): Promise<HydratedVisitorLead> {
  const doc = await VisitorLead.findOne({ _id: requireId(id), deletedAt: null });
  if (!doc) throw new HttpError(404, 'NOT_FOUND', 'Visitor lead not found.');
  return doc;
}

export async function updateVisitorLead(
  id: string,
  patch: UpdateVisitorLeadInput,
  actor: ActorContext & { actorUserId: Types.ObjectId },
): Promise<HydratedVisitorLead> {
  const doc = await findVisitorLeadById(id);
  const before = doc.toObject();

  if (patch.firstName !== undefined) doc.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) doc.lastName = patch.lastName.trim();
  if (patch.highestQualification !== undefined) {
    doc.highestQualification = patch.highestQualification;
  }
  if (patch.dateOfBirth !== undefined) {
    doc.dateOfBirth = parseDob(patch.dateOfBirth);
  }
  if (patch.currentAddress !== undefined) {
    doc.currentAddress = normalizeAddress(patch.currentAddress);
  }
  if (patch.phoneE164 !== undefined && patch.phoneE164 !== doc.phoneE164) {
    const clash = await VisitorLead.findOne({
      phoneE164: patch.phoneE164,
      deletedAt: null,
      _id: { $ne: doc._id },
    });
    if (clash) {
      throw new HttpError(
        409,
        'LEAD_EXISTS',
        'Another active visitor lead is already using this phone number.',
      );
    }
    doc.phoneE164 = patch.phoneE164;
  }
  if (patch.email !== undefined) doc.email = patch.email?.trim().toLowerCase() || null;
  if (patch.parentGuardianContact !== undefined) {
    doc.parentGuardianContact = patch.parentGuardianContact?.trim() || null;
  }
  if (patch.leadSource !== undefined) doc.leadSource = patch.leadSource;
  if (patch.socialMediaId !== undefined) {
    doc.socialMediaId = patch.socialMediaId?.trim() || null;
  }
  if (patch.otpVerificationStatus !== undefined) {
    doc.otpVerificationStatus = patch.otpVerificationStatus;
  }
  if (patch.status !== undefined) doc.status = patch.status;
  if (patch.notes !== undefined) doc.notes = patch.notes?.trim() || null;
  if (patch.assignedToUserId !== undefined) {
    doc.assignedToUserId =
      patch.assignedToUserId && Types.ObjectId.isValid(patch.assignedToUserId)
        ? new Types.ObjectId(patch.assignedToUserId)
        : null;
  }

  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'visitor_lead.updated',
    targetType: 'VisitorLead',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}

export async function softDeleteVisitorLead(
  id: string,
  actor: ActorContext & { actorUserId: Types.ObjectId },
): Promise<HydratedVisitorLead> {
  const doc = await findVisitorLeadById(id);
  const before = doc.toObject();
  await VisitorLead.updateOne(
    { _id: doc._id },
    { $set: { deletedAt: new Date(), status: 'dropped' as VisitorLeadStatus } },
  );
  const after = await VisitorLead.findById(doc._id);
  if (!after) {
    throw new HttpError(500, 'INTERNAL', 'Soft-deleted lead vanished.');
  }
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'visitor_lead.deleted',
    targetType: 'VisitorLead',
    targetId: after._id,
    before,
    after: after.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return after;
}

/**
 * Mark a lead as converted by linking it to an ApplicationDraft. The
 * draft itself is created elsewhere (the existing /admissions/apply
 * pipeline); this just records the link so admins can see "this lead
 * became this applicant".
 */
export async function markLeadConverted(
  id: string,
  applicationDraftId: Types.ObjectId,
  actor: ActorContext & { actorUserId: Types.ObjectId },
): Promise<HydratedVisitorLead> {
  const doc = await findVisitorLeadById(id);
  const before = doc.toObject();
  doc.convertedApplicationId = applicationDraftId;
  doc.status = 'converted';
  await doc.save();
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'visitor_lead.converted',
    targetType: 'VisitorLead',
    targetId: doc._id,
    before,
    after: doc.toObject(),
    ip: actor.ip,
    ua: actor.ua,
  });
  return doc;
}
