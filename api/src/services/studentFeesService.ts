import { Types } from 'mongoose';
import type {
  EnrollmentAccessState,
  OutstandingFeesDto,
  StudentFeesDto,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  CreditNote,
  Enrollment,
  FeeInstallment,
  Invoice,
  Receipt,
  User,
  type HydratedFeeInstallment,
  type HydratedInvoice,
} from '../models/index.js';
import {
  toInstallmentDto,
  toInvoiceDto,
} from './invoiceGenerationService.js';
import { toReceiptDto } from './receiptService.js';
import { toCreditNoteDto } from './paymentService.js';

interface AggregateRaw {
  invoices: HydratedInvoice[];
  installments: HydratedFeeInstallment[];
}

async function loadAggregates(studentId: Types.ObjectId): Promise<AggregateRaw> {
  const [invoices, installments] = await Promise.all([
    Invoice.find({ studentId }).sort({ createdAt: 1 }),
    FeeInstallment.find({ studentId }).sort({ dueDate: 1 }),
  ]);
  return { invoices, installments };
}

function effectiveAccessState(
  enrolments: Array<{ accessState: EnrollmentAccessState }>,
): EnrollmentAccessState {
  const order: EnrollmentAccessState[] = [
    'active',
    'warn1',
    'warn2',
    'override',
    'suspended',
  ];
  let worst: EnrollmentAccessState = 'active';
  for (const e of enrolments) {
    if (order.indexOf(e.accessState) > order.indexOf(worst)) {
      worst = e.accessState;
    }
  }
  return worst;
}

export async function buildStudentFees(studentId: string): Promise<StudentFeesDto> {
  if (!Types.ObjectId.isValid(studentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }
  const objectId = new Types.ObjectId(studentId);
  const student = await User.findById(objectId);
  if (!student || student.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
  }

  const { invoices, installments } = await loadAggregates(objectId);
  const [enrolments, receipts, creditNotes] = await Promise.all([
    Enrollment.find({ studentId: objectId }).select('accessState status'),
    Receipt.find({ studentId: objectId }).sort({ issuedAt: -1 }),
    CreditNote.find({ studentId: objectId }).sort({ issuedAt: -1 }),
  ]);

  const totalPaise = invoices.reduce((s, i) => s + i.totalPaise, 0);
  const paidPaise = invoices.reduce((s, i) => s + i.paidPaise, 0);
  const balancePaise = Math.max(0, totalPaise - paidPaise);

  const unpaidSorted = installments
    .filter((i) => i.amountPaise - i.paidPaise > 0 && i.status !== 'waived')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const next = unpaidSorted[0];

  const accessState = effectiveAccessState(
    enrolments.filter((e) => e.status === 'active'),
  );

  return {
    studentId: String(student._id),
    totalPaise,
    paidPaise,
    balancePaise,
    nextDueDate: next ? next.dueDate.toISOString() : null,
    nextDueAmountPaise: next ? next.amountPaise - next.paidPaise : null,
    invoices: invoices.map(toInvoiceDto),
    installments: installments.map(toInstallmentDto),
    receipts: receipts.map(toReceiptDto),
    creditNotes: creditNotes.map(toCreditNoteDto),
    accessState,
    suspensionOverrideUntil: student.suspensionOverrideUntil
      ? student.suspensionOverrideUntil.toISOString()
      : null,
  };
}

export async function buildOutstandingFees(
  studentId: Types.ObjectId,
): Promise<OutstandingFeesDto> {
  const installments = await FeeInstallment.find({
    studentId,
    status: { $in: ['pending', 'partial', 'overdue'] },
  }).sort({ dueDate: 1 });

  const totalPaise = installments.reduce(
    (s, i) => s + Math.max(0, i.amountPaise - i.paidPaise),
    0,
  );
  const invoiceIds = new Set<string>();
  installments.forEach((i) => invoiceIds.add(i.invoiceId.toString()));
  const next = installments[0] ?? null;

  return {
    stub: false,
    totalPaise,
    invoiceCount: invoiceIds.size,
    nextDueDate: next ? next.dueDate.toISOString() : null,
    nextDueAmountPaise: next ? Math.max(0, next.amountPaise - next.paidPaise) : null,
  };
}
