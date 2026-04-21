import { Types } from 'mongoose';
import type {
  CreditNoteDto,
  PaymentAllocationDto,
  PaymentDto,
  PaymentMethod,
  RecordPaymentInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  CreditNote,
  FeeInstallment,
  Invoice,
  Payment,
  type HydratedCreditNote,
  type HydratedPayment,
  type HydratedReceipt,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { nextCreditNoteCode } from './counterService.js';
import { nowUtc } from './clockService.js';
import { enqueueNotification } from './notificationService.js';
import { formatPaiseAsRupees } from './amountInWordsService.js';
import { persistReceipt, getSignedReceiptUrl } from './receiptService.js';
import { reconcileForStudent } from './suspensionService.js';

const REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000; // PRD §9.6

export interface RecordPaymentCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

interface AllocationPlan {
  installmentId: Types.ObjectId;
  amountPaise: number;
}

async function planAutoAllocations(
  studentId: Types.ObjectId,
  amountPaise: number,
): Promise<{ plan: AllocationPlan[]; remainder: number }> {
  const unpaid = await FeeInstallment.find({
    studentId,
    status: { $in: ['pending', 'partial', 'overdue'] },
  }).sort({ dueDate: 1, _id: 1 });
  const plan: AllocationPlan[] = [];
  let remaining = amountPaise;
  for (const inst of unpaid) {
    if (remaining <= 0) break;
    const open = inst.amountPaise - inst.paidPaise;
    if (open <= 0) continue;
    const take = Math.min(open, remaining);
    plan.push({ installmentId: inst._id, amountPaise: take });
    remaining -= take;
  }
  return { plan, remainder: remaining };
}

async function applyAllocations(
  allocations: AllocationPlan[],
): Promise<void> {
  for (const a of allocations) {
    const inst = await FeeInstallment.findById(a.installmentId);
    if (!inst) {
      throw new HttpError(
        404,
        'NOT_FOUND',
        `Installment ${a.installmentId.toString()} not found.`,
      );
    }
    const open = inst.amountPaise - inst.paidPaise;
    if (a.amountPaise > open) {
      throw new HttpError(
        422,
        'PAYMENT_OVERAPPLIED',
        `Allocation ${a.amountPaise} exceeds open balance ${open} on installment.`,
      );
    }
    if (open === 0) {
      throw new HttpError(
        409,
        'INSTALLMENT_ALREADY_PAID',
        'Cannot allocate to a paid or waived installment.',
      );
    }
    inst.paidPaise += a.amountPaise;
    if (inst.paidPaise >= inst.amountPaise) {
      inst.status = 'paid';
    } else if (inst.paidPaise > 0) {
      inst.status = 'partial';
    }
    await inst.save();

    const invoice = await Invoice.findById(inst.invoiceId);
    if (invoice) {
      invoice.paidPaise += a.amountPaise;
      invoice.balancePaise = Math.max(0, invoice.totalPaise - invoice.paidPaise);
      invoice.status = invoice.balancePaise === 0 ? 'settled' : 'open';
      await invoice.save();
    }
  }
}

export interface RecordedPayment {
  payment: HydratedPayment;
  receipt: HydratedReceipt;
  creditNote: HydratedCreditNote | null;
}

export async function recordPayment(
  input: RecordPaymentInput,
  ctx: RecordPaymentCtx,
): Promise<RecordedPayment> {
  if (!input.amountPaise || input.amountPaise <= 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'amountPaise must be > 0.');
  }
  if (!Types.ObjectId.isValid(input.studentId)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'studentId invalid.');
  }
  const studentObjectId = new Types.ObjectId(input.studentId);
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : nowUtc();
  if (Number.isNaN(receivedAt.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'receivedAt is not a valid date.');
  }

  let plan: AllocationPlan[];
  let overpayment = 0;
  if (input.allocations && input.allocations.length > 0) {
    const explicit: AllocationPlan[] = input.allocations.map(
      (a: PaymentAllocationDto) => {
        if (!Types.ObjectId.isValid(a.installmentId)) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'allocations[].installmentId invalid.',
          );
        }
        if (!Number.isFinite(a.amountPaise) || a.amountPaise <= 0) {
          throw new HttpError(
            422,
            'VALIDATION_FAILED',
            'allocations[].amountPaise must be > 0.',
          );
        }
        return {
          installmentId: new Types.ObjectId(a.installmentId),
          amountPaise: a.amountPaise,
        };
      },
    );
    const explicitSum = explicit.reduce((s, a) => s + a.amountPaise, 0);
    if (explicitSum > input.amountPaise) {
      throw new HttpError(
        422,
        'PAYMENT_OVERAPPLIED',
        'Sum of explicit allocations exceeds payment amount.',
      );
    }
    plan = explicit;
    overpayment = input.amountPaise - explicitSum;
  } else {
    const auto = await planAutoAllocations(studentObjectId, input.amountPaise);
    plan = auto.plan;
    overpayment = auto.remainder;
  }

  await applyAllocations(plan);

  const payment = await Payment.create({
    studentId: studentObjectId,
    receivedAt,
    amountPaise: input.amountPaise,
    method: input.method,
    reference: input.reference ?? '',
    allocations: plan,
    receivedByUserId: ctx.actorUserId,
    notes: input.notes ?? '',
    reversed: false,
    reversedAt: null,
    creditNoteId: null,
  });

  const receipt = await persistReceipt(payment, { issuedByUserId: ctx.actorUserId });

  let creditNote: HydratedCreditNote | null = null;
  if (overpayment > 0) {
    const year = receivedAt.getUTCFullYear();
    const code = await nextCreditNoteCode(year);
    creditNote = await CreditNote.create({
      code,
      paymentId: payment._id,
      studentId: studentObjectId,
      amountPaise: overpayment,
      balancePaise: overpayment,
      reason: 'Overpayment on POST /v1/payments',
      consumed: false,
      issuedAt: receivedAt,
      issuedByUserId: ctx.actorUserId,
    });
    payment.creditNoteId = creditNote._id;
    await payment.save();
    await recordAudit({
      actorUserId: ctx.actorUserId,
      action: 'fees.credit_note.issued',
      targetType: 'CreditNote',
      targetId: creditNote._id,
      after: creditNote.toJSON(),
    });
  }

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'fees.payment.recorded',
    targetType: 'Payment',
    targetId: payment._id,
    after: payment.toJSON(),
    details: { receiptId: String(receipt._id) },
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // Payment may clear outstanding balance → lifts fees-suspension.
  await reconcileForStudent(studentObjectId, {
    actorUserId: ctx.actorUserId,
    audit: true,
    ip: ctx.ip,
    ua: ctx.ua,
  });

  // fees.paid notification (inapp + email + whatsapp if enabled).
  try {
    const receiptUrl = await getSignedReceiptUrl(receipt, 3600);
    await enqueueNotification({
      type: 'fees.paid',
      recipients: [studentObjectId],
      title: 'Payment received',
      body: `We have received your payment of ${formatPaiseAsRupees(payment.amountPaise)}. Your receipt ${receipt.code} is ready to download.`,
      data: {
        paymentId: payment._id.toString(),
        receiptId: receipt._id.toString(),
        receiptCode: receipt.code,
        amountPaise: payment.amountPaise,
        receiptUrl,
      },
    });
  } catch {
    // Notification failure never blocks payment recording.
  }

  return { payment, receipt, creditNote };
}

export interface ReversePaymentCtx {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export interface ReversedPayment {
  payment: HydratedPayment;
  creditNote: HydratedCreditNote;
}

export async function reversePayment(
  paymentId: string,
  reason: string,
  ctx: ReversePaymentCtx,
): Promise<ReversedPayment> {
  if (!Types.ObjectId.isValid(paymentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Payment not found.');
  }
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new HttpError(404, 'NOT_FOUND', 'Payment not found.');
  }
  if (payment.reversed) {
    throw new HttpError(409, 'CONFLICT', 'Payment already reversed.');
  }
  const now = nowUtc();
  if (now.getTime() - payment.receivedAt.getTime() > REVERSAL_WINDOW_MS) {
    throw new HttpError(
      409,
      'REVERSAL_WINDOW_EXPIRED',
      'Payment can only be reversed within 24 hours.',
    );
  }

  // Debit each installment the payment originally credited.
  for (const alloc of payment.allocations) {
    const inst = await FeeInstallment.findById(alloc.installmentId);
    if (!inst) continue;
    inst.paidPaise = Math.max(0, inst.paidPaise - alloc.amountPaise);
    if (inst.paidPaise === 0) {
      inst.status = 'pending';
    } else {
      inst.status = 'partial';
    }
    await inst.save();

    const invoice = await Invoice.findById(inst.invoiceId);
    if (invoice) {
      invoice.paidPaise = Math.max(0, invoice.paidPaise - alloc.amountPaise);
      invoice.balancePaise = Math.max(0, invoice.totalPaise - invoice.paidPaise);
      invoice.status = invoice.balancePaise === 0 ? 'settled' : 'open';
      await invoice.save();
    }
  }

  const year = now.getUTCFullYear();
  const code = await nextCreditNoteCode(year);
  const creditNote = await CreditNote.create({
    code,
    paymentId: payment._id,
    studentId: payment.studentId,
    amountPaise: payment.amountPaise,
    balancePaise: payment.amountPaise,
    reason: reason || 'Payment reversed',
    consumed: false,
    issuedAt: now,
    issuedByUserId: ctx.actorUserId,
  });

  payment.reversed = true;
  payment.reversedAt = now;
  payment.reversedByUserId = ctx.actorUserId;
  payment.creditNoteId = creditNote._id;
  await payment.save();

  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'fees.payment.reversed',
    targetType: 'Payment',
    targetId: payment._id,
    after: payment.toJSON(),
    details: { creditNoteId: String(creditNote._id), reason },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  await recordAudit({
    actorUserId: ctx.actorUserId,
    action: 'fees.credit_note.issued',
    targetType: 'CreditNote',
    targetId: creditNote._id,
    after: creditNote.toJSON(),
  });

  // Reversal may re-open an overdue installment → may re-suspend.
  await reconcileForStudent(payment.studentId, {
    actorUserId: ctx.actorUserId,
    audit: true,
    ip: ctx.ip,
    ua: ctx.ua,
  });

  return { payment, creditNote };
}

export function toPaymentDto(doc: HydratedPayment): PaymentDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    studentId: doc.studentId.toString(),
    receivedAt: doc.receivedAt.toISOString(),
    amountPaise: doc.amountPaise,
    method: doc.method as PaymentMethod,
    reference: doc.reference,
    allocations: doc.allocations.map((a) => ({
      installmentId: a.installmentId.toString(),
      amountPaise: a.amountPaise,
    })),
    receivedByUserId: doc.receivedByUserId.toString(),
    notes: doc.notes,
    reversed: doc.reversed,
    reversedAt: doc.reversedAt ? doc.reversedAt.toISOString() : null,
    creditNoteId: doc.creditNoteId ? doc.creditNoteId.toString() : null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

export function toCreditNoteDto(doc: HydratedCreditNote): CreditNoteDto {
  return {
    id: doc._id.toString(),
    code: doc.code,
    paymentId: doc.paymentId ? doc.paymentId.toString() : null,
    studentId: doc.studentId.toString(),
    amountPaise: doc.amountPaise,
    balancePaise: doc.balancePaise,
    reason: doc.reason,
    consumed: doc.consumed,
    issuedAt: doc.issuedAt.toISOString(),
  };
}
