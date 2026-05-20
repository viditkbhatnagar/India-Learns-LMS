import { Types } from 'mongoose';
import type { Role } from 'india-learns-shared-types';
import {
  FeeInstallment,
  Invoice,
  type HydratedFeeInstallment,
  type HydratedInvoice,
} from '../models/index.js';
import { HttpError } from '../middleware/error.js';
import { recordAudit } from './auditService.js';
import type { ActorContext } from './userService.js';

// M10s — Manual installment management. Admin can edit individual
// installments after auto-gen (PATCH amount / due-date / label) and add
// custom installment rows on existing invoices (POST). Logan's Excel
// shows fully manual schedules with milestone-based labels like
// "Seat Reservation" and "Upon Admission" alongside date-driven rows.
//
// Each mutation recomputes the parent Invoice's totalPaise + balancePaise
// so the student fees view + admin collections dashboard stay accurate.

function requireId(id: string, label = 'Installment'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

function assertAdmin(role: Role): void {
  if (role !== 'admin' && role !== 'superadmin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins may edit installments.');
  }
}

async function recomputeInvoiceTotals(invoiceId: Types.ObjectId): Promise<HydratedInvoice> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.');
  }
  const installments = await FeeInstallment.find({ invoiceId });
  const totalPaise = installments.reduce(
    (sum, inst) => sum + (inst.status === 'waived' ? 0 : inst.amountPaise),
    0,
  );
  const paidPaise = installments.reduce((sum, inst) => sum + inst.paidPaise, 0);
  const balancePaise = Math.max(0, totalPaise - paidPaise);
  invoice.totalPaise = totalPaise;
  invoice.paidPaise = paidPaise;
  invoice.balancePaise = balancePaise;
  // Status follows balance: fully paid → 'settled'; otherwise 'open'.
  invoice.status = balancePaise === 0 && totalPaise > 0 ? 'settled' : 'open';
  await invoice.save();
  return invoice;
}

export interface PatchInstallmentInput {
  label?: string;
  amountPaise?: number;
  dueDate?: string; // ISO date (YYYY-MM-DD or full ISO)
  status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
}

export async function patchInstallment(
  id: string,
  patch: PatchInstallmentInput,
  actor: { role: Role } & ActorContext,
): Promise<{ installment: HydratedFeeInstallment; invoice: HydratedInvoice }> {
  assertAdmin(actor.role);
  const inst = await FeeInstallment.findById(requireId(id));
  if (!inst) throw new HttpError(404, 'NOT_FOUND', 'Installment not found.');
  const before = inst.toJSON();

  if (patch.label !== undefined) inst.label = patch.label.trim();
  if (patch.amountPaise !== undefined) {
    if (!Number.isFinite(patch.amountPaise) || patch.amountPaise < 0) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'amountPaise must be ≥ 0.');
    }
    if (patch.amountPaise < inst.paidPaise) {
      throw new HttpError(
        422,
        'AMOUNT_BELOW_PAID',
        'New amount cannot be less than what has already been paid for this installment.',
      );
    }
    inst.amountPaise = Math.floor(patch.amountPaise);
  }
  if (patch.dueDate !== undefined) {
    const parsed = new Date(patch.dueDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'dueDate must be a valid ISO date.');
    }
    inst.dueDate = parsed;
  }
  if (patch.status !== undefined) {
    inst.status = patch.status;
  }
  await inst.save();
  const invoice = await recomputeInvoiceTotals(inst.invoiceId);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'fees.installment.updated',
    targetType: 'FeeInstallment',
    targetId: inst._id,
    before,
    after: inst.toJSON(),
    details: {
      invoiceId: String(inst.invoiceId),
      studentId: String(inst.studentId),
    },
    ip: actor.ip,
    ua: actor.ua,
  });
  return { installment: inst, invoice };
}

export interface CreateInstallmentInput {
  invoiceId: string;
  label: string;
  amountPaise: number;
  dueDate: string;
  status?: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';
}

export async function createInstallment(
  input: CreateInstallmentInput,
  actor: { role: Role } & ActorContext,
): Promise<{ installment: HydratedFeeInstallment; invoice: HydratedInvoice }> {
  assertAdmin(actor.role);
  const invoiceId = requireId(input.invoiceId, 'Invoice');
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new HttpError(404, 'NOT_FOUND', 'Invoice not found.');
  if (!Number.isFinite(input.amountPaise) || input.amountPaise < 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'amountPaise must be ≥ 0.');
  }
  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'dueDate must be a valid ISO date.');
  }
  const inst = await FeeInstallment.create({
    invoiceId,
    studentId: invoice.studentId,
    label: input.label.trim(),
    amountPaise: Math.floor(input.amountPaise),
    paidPaise: 0,
    dueDate: due,
    status: input.status ?? 'pending',
    remindersSent: [],
  });
  const refreshed = await recomputeInvoiceTotals(invoiceId);
  await recordAudit({
    actorUserId: actor.actorUserId,
    action: 'fees.installment.created',
    targetType: 'FeeInstallment',
    targetId: inst._id,
    after: inst.toJSON(),
    details: {
      invoiceId: String(invoiceId),
      studentId: String(invoice.studentId),
    },
    ip: actor.ip,
    ua: actor.ua,
  });
  return { installment: inst, invoice: refreshed };
}

export async function waiveInstallment(
  id: string,
  actor: { role: Role } & ActorContext,
): Promise<{ installment: HydratedFeeInstallment; invoice: HydratedInvoice }> {
  return patchInstallment(id, { status: 'waived' }, actor);
}
