import { Types } from 'mongoose';
import type {
  ApplicationFeeDto,
  ApplicationPaymentDto,
  PaymentMethod,
  RecordApplicationPaymentInput,
} from 'india-learns-shared-types';
import { HttpError } from '../../middleware/error.js';
import {
  Application,
  ApplicationFee,
  ApplicationPayment,
  Program,
  type HydratedApplicationFee,
  type HydratedApplicationPayment,
} from '../../models/index.js';
import { appendAdmissionsAudit } from './admissionsAuditService.js';

// M6 — Application fee tracking.
//
// Fees are created at Application.submit time using the program's
// applicationFeePaise. If a program is free (fee 0), the row is created with
// status='paid' and paidAt=now so the admit gate is non-blocking.

export async function ensureFeeForApplication(
  applicationId: Types.ObjectId,
): Promise<HydratedApplicationFee> {
  const app = await Application.findById(applicationId);
  if (!app) throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  const existing = await ApplicationFee.findOne({ applicationId });
  if (existing) return existing;
  if (!app.programId) {
    throw new HttpError(
      409,
      'PROGRAM_MISSING',
      'Application has no program assigned; cannot create fee.',
    );
  }
  const program = await Program.findById(app.programId);
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program not found.');
  const amountPaise = Math.max(0, program.applicationFeePaise);
  const status = amountPaise === 0 ? 'paid' : 'pending';
  const paidAt = amountPaise === 0 ? new Date() : null;
  return ApplicationFee.create({
    applicationId,
    programId: program._id,
    applicantUserId: app.applicantUserId,
    amountPaise,
    status,
    paidAt,
  });
}

export async function getFeeForApplicant(
  applicantUserId: Types.ObjectId,
): Promise<HydratedApplicationFee | null> {
  return ApplicationFee.findOne({ applicantUserId });
}

export async function getFeeForApplication(
  applicationId: string,
): Promise<HydratedApplicationFee | null> {
  if (!Types.ObjectId.isValid(applicationId)) return null;
  return ApplicationFee.findOne({ applicationId: new Types.ObjectId(applicationId) });
}

export async function recordApplicationPayment(
  applicationId: string,
  actorUserId: Types.ObjectId,
  input: RecordApplicationPaymentInput,
): Promise<{ fee: HydratedApplicationFee; payment: HydratedApplicationPayment }> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  }
  const fee = await ApplicationFee.findOne({
    applicationId: new Types.ObjectId(applicationId),
  });
  if (!fee) {
    throw new HttpError(404, 'NOT_FOUND', 'Application fee not found.');
  }
  if (fee.status === 'paid') {
    throw new HttpError(409, 'ALREADY_PAID', 'Fee is already marked paid.');
  }
  if (fee.status === 'waived') {
    throw new HttpError(409, 'ALREADY_WAIVED', 'Fee is already waived.');
  }
  if (input.amountPaise < fee.amountPaise) {
    throw new HttpError(
      422,
      'AMOUNT_TOO_LOW',
      `Payment must be at least ₹${fee.amountPaise / 100} (the fee due).`,
    );
  }
  const payment = await ApplicationPayment.create({
    applicationFeeId: fee._id,
    applicantUserId: fee.applicantUserId,
    amountPaise: input.amountPaise,
    method: input.method,
    reference: input.reference ?? '',
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    recordedByUserId: actorUserId,
    notes: input.notes ?? '',
  });
  fee.status = 'paid';
  fee.paidAt = payment.receivedAt;
  fee.paymentId = payment._id;
  await fee.save();
  await appendAdmissionsAudit({
    applicationId: fee.applicationId,
    actorUserId,
    action: 'application_fee.recorded',
    details: {
      paymentId: String(payment._id),
      amountPaise: payment.amountPaise,
      method: payment.method,
      reference: payment.reference,
    },
  });
  return { fee, payment };
}

export async function waiveApplicationFee(
  applicationId: string,
  actorUserId: Types.ObjectId,
  reason: string,
): Promise<HydratedApplicationFee> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Application not found.');
  }
  const fee = await ApplicationFee.findOne({
    applicationId: new Types.ObjectId(applicationId),
  });
  if (!fee) throw new HttpError(404, 'NOT_FOUND', 'Application fee not found.');
  if (fee.status === 'paid') {
    throw new HttpError(
      409,
      'ALREADY_PAID',
      'Cannot waive — fee is already paid.',
    );
  }
  if (fee.status === 'waived') {
    throw new HttpError(409, 'ALREADY_WAIVED', 'Fee is already waived.');
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Waiver reason is required.');
  }
  fee.status = 'waived';
  fee.waivedAt = new Date();
  fee.waivedBy = actorUserId;
  fee.waivedReason = trimmed;
  await fee.save();
  await appendAdmissionsAudit({
    applicationId: fee.applicationId,
    actorUserId,
    action: 'application_fee.waived',
    details: { reason: trimmed },
  });
  return fee;
}

export function toApplicationFeeDto(
  doc: HydratedApplicationFee,
): ApplicationFeeDto {
  return {
    id: String(doc._id),
    applicationId: doc.applicationId.toString(),
    programId: doc.programId.toString(),
    amountPaise: doc.amountPaise,
    status: doc.status,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    waivedAt: doc.waivedAt ? doc.waivedAt.toISOString() : null,
    waivedReason: doc.waivedReason,
  };
}

export function toApplicationPaymentDto(
  doc: HydratedApplicationPayment,
): ApplicationPaymentDto {
  return {
    id: String(doc._id),
    applicationFeeId: doc.applicationFeeId.toString(),
    amountPaise: doc.amountPaise,
    method: doc.method as PaymentMethod,
    reference: doc.reference,
    receivedAt: doc.receivedAt.toISOString(),
    recordedByUserId: doc.recordedByUserId.toString(),
    notes: doc.notes,
  };
}

// Used by the admit gate: throws 402 if the fee isn't paid/waived.
export async function assertFeeClearedForAdmit(
  applicationId: Types.ObjectId,
): Promise<void> {
  const fee = await ApplicationFee.findOne({ applicationId });
  if (!fee) {
    throw new HttpError(
      402,
      'FEE_REQUIRED',
      'Application fee not yet recorded. Cannot admit until paid or waived.',
    );
  }
  if (fee.status !== 'paid' && fee.status !== 'waived') {
    throw new HttpError(
      402,
      'FEE_REQUIRED',
      `Cannot admit — application fee is ${fee.status}. Record payment or waive first.`,
    );
  }
}
