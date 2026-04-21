import { Types } from 'mongoose';
import type {
  InvoiceDto,
  FeeInstallmentDto,
  FeeReminderTemplate,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  Enrollment,
  FeeInstallment,
  FeeStructure,
  Invoice,
  type FeeComponentDoc,
  type HydratedInvoice,
  type HydratedFeeInstallment,
} from '../models/index.js';
import { recordAudit } from './auditService.js';
import { nextInvoiceCode } from './counterService.js';
import { resolveInstallmentDueDate } from './dueRuleResolver.js';

function computeInstallmentAmountsPaise(component: FeeComponentDoc): number[] {
  if (component.cadence === 'one_time') return [component.amountPaise];
  const count = component.monthlyCount ?? 1;
  if (component.weights && component.weights.length === count) {
    const totalWeight = component.weights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'Fee component weights must sum to a positive number.',
      );
    }
    // Largest-remainder allocation so the sum matches amountPaise exactly.
    const weighted = component.weights.map((w) =>
      (component.amountPaise * w) / totalWeight,
    );
    const floors = weighted.map((v) => Math.floor(v));
    let residual = component.amountPaise - floors.reduce((s, v) => s + v, 0);
    const sortedIdx = weighted
      .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac)
      .map((x) => x.idx);
    let i = 0;
    while (residual > 0 && sortedIdx.length > 0) {
      const target = sortedIdx[i % sortedIdx.length]!;
      floors[target] = (floors[target] ?? 0) + 1;
      residual -= 1;
      i += 1;
    }
    return floors;
  }
  const base = Math.floor(component.amountPaise / count);
  const leftover = component.amountPaise - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(i === 0 ? base + leftover : base);
  }
  return out;
}

function installmentLabel(
  component: FeeComponentDoc,
  index: number,
): string {
  if (component.cadence === 'one_time') return component.label;
  return `${component.label} — Installment ${index + 1}`;
}

export interface GenerateFeesResult {
  invoices: HydratedInvoice[];
  installments: HydratedFeeInstallment[];
  createdCount: number;
  skippedCount: number;
}

export interface ActorContext {
  actorUserId: Types.ObjectId;
  ip?: string;
  ua?: string;
}

export async function generateForEnrollment(
  enrollmentId: string,
  actor: ActorContext,
): Promise<GenerateFeesResult> {
  if (!Types.ObjectId.isValid(enrollmentId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Enrollment not found.');
  }
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) {
    throw new HttpError(404, 'NOT_FOUND', 'Enrollment not found.');
  }

  const structure = await FeeStructure.findOne({
    programId: enrollment.programId,
    deletedAt: null,
  }).sort({ createdAt: -1 });
  if (!structure) {
    throw new HttpError(
      422,
      'FEE_STRUCTURE_MISSING',
      'No FeeStructure configured for this program.',
    );
  }

  const batch = await Batch.findById(enrollment.batchId);
  if (!batch) {
    throw new HttpError(422, 'BATCH_MISSING', 'Enrollment batch not found.');
  }

  const year = enrollment.validFrom.getUTCFullYear();
  const invoices: HydratedInvoice[] = [];
  const installments: HydratedFeeInstallment[] = [];
  let createdCount = 0;
  let skippedCount = 0;

  for (const component of structure.components) {
    const existing = await Invoice.findOne({
      enrollmentId: enrollment._id,
      componentKind: component.kind,
      componentLabel: component.label,
    });
    if (existing) {
      invoices.push(existing);
      const existingInstalls = await FeeInstallment.find({ invoiceId: existing._id });
      installments.push(...existingInstalls);
      skippedCount += 1;
      continue;
    }

    const code = await nextInvoiceCode(year);
    const invoice = await Invoice.create({
      code,
      enrollmentId: enrollment._id,
      studentId: enrollment.studentId,
      feeStructureId: structure._id,
      componentKind: component.kind,
      componentLabel: component.label,
      totalPaise: component.amountPaise,
      paidPaise: 0,
      balancePaise: component.amountPaise,
      status: 'open',
    });
    invoices.push(invoice);
    createdCount += 1;

    const amounts = computeInstallmentAmountsPaise(component);
    for (let i = 0; i < amounts.length; i += 1) {
      const amountPaise = amounts[i]!;
      const dueDate = resolveInstallmentDueDate(component.dueRule, i, {
        enrolmentAnchor: enrollment.validFrom,
        batchEndDate: batch.endDate,
      });
      const installment = await FeeInstallment.create({
        invoiceId: invoice._id,
        studentId: enrollment.studentId,
        label: installmentLabel(component, i),
        amountPaise,
        paidPaise: 0,
        dueDate,
        status: 'pending',
        remindersSent: [],
      });
      installments.push(installment);
    }

    await recordAudit({
      actorUserId: actor.actorUserId,
      action: 'fees.invoice.generated',
      targetType: 'Invoice',
      targetId: invoice._id,
      after: invoice.toJSON(),
      details: {
        enrollmentId: String(enrollment._id),
        installmentCount: amounts.length,
      },
      ip: actor.ip,
      ua: actor.ua,
    });
  }

  return { invoices, installments, createdCount, skippedCount };
}

export function toInvoiceDto(doc: HydratedInvoice): InvoiceDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    code: doc.code,
    enrollmentId: doc.enrollmentId.toString(),
    studentId: doc.studentId.toString(),
    feeStructureId: doc.feeStructureId.toString(),
    componentKind: doc.componentKind,
    componentLabel: doc.componentLabel,
    totalPaise: doc.totalPaise,
    paidPaise: doc.paidPaise,
    balancePaise: doc.balancePaise,
    status: doc.status,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export function toInstallmentDto(doc: HydratedFeeInstallment): FeeInstallmentDto {
  const json = doc.toJSON() as Record<string, unknown>;
  return {
    id: String(json.id),
    invoiceId: doc.invoiceId.toString(),
    studentId: doc.studentId.toString(),
    label: doc.label,
    amountPaise: doc.amountPaise,
    paidPaise: doc.paidPaise,
    balancePaise: Math.max(0, doc.amountPaise - doc.paidPaise),
    dueDate: doc.dueDate.toISOString(),
    status: doc.status,
    remindersSent: doc.remindersSent.map((r) => ({
      template: r.template as FeeReminderTemplate,
      at: r.at.toISOString(),
    })),
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}
