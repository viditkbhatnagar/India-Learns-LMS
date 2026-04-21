import type { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { formatInTimeZone } from 'date-fns-tz';
import type { ReceiptDto } from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { getIntegrations } from '../integrations/index.js';
import {
  Enrollment,
  FeeInstallment,
  Invoice,
  Program,
  Receipt,
  User,
  type HydratedPayment,
  type HydratedReceipt,
} from '../models/index.js';
import { nextReceiptCode } from './counterService.js';
import { formatPaiseAsRupees, paiseToIndianWords } from './amountInWordsService.js';
import { nowUtc } from './clockService.js';
import { recordAudit } from './auditService.js';

const IST_TZ = 'Asia/Kolkata';

// PRD §9.6 — Receipt code resets on 1 April each year. Use the Indian financial
// year as the counter key year.
export function financialYearFor(date: Date): number {
  const y = Number(formatInTimeZone(date, IST_TZ, 'yyyy'));
  const m = Number(formatInTimeZone(date, IST_TZ, 'MM'));
  return m >= 4 ? y : y - 1;
}

function istStamp(date: Date): string {
  return formatInTimeZone(date, IST_TZ, 'dd MMM yyyy, EEE · HH:mm');
}

export interface ReceiptContext {
  issuedByUserId: Types.ObjectId;
}

export interface ReceiptRenderInput {
  receiptCode: string;
  issuedByUserId: Types.ObjectId;
}

export async function generateReceiptPdf(
  payment: HydratedPayment,
  input: ReceiptRenderInput,
): Promise<Buffer> {
  const env = loadEnv();
  const [student, installmentDocs] = await Promise.all([
    User.findById(payment.studentId),
    FeeInstallment.find({
      _id: { $in: payment.allocations.map((a) => a.installmentId) },
    }),
  ]);
  if (!student) {
    throw new Error('Receipt: student not found.');
  }

  const installmentMap = new Map<string, (typeof installmentDocs)[number]>();
  installmentDocs.forEach((i) => installmentMap.set(i._id.toString(), i));

  const invoiceIds = new Set<string>();
  installmentDocs.forEach((i) => invoiceIds.add(i.invoiceId.toString()));
  const invoices = invoiceIds.size
    ? await Invoice.find({ _id: { $in: Array.from(invoiceIds) } })
    : [];
  const invoiceMap = new Map<string, (typeof invoices)[number]>();
  invoices.forEach((inv) => invoiceMap.set(inv._id.toString(), inv));

  const enrollmentIds = new Set<string>();
  invoices.forEach((inv) => enrollmentIds.add(inv.enrollmentId.toString()));
  const enrollments = enrollmentIds.size
    ? await Enrollment.find({ _id: { $in: Array.from(enrollmentIds) } })
    : [];
  const programIds = new Set<string>();
  enrollments.forEach((e) => programIds.add(e.programId.toString()));
  const programs = programIds.size
    ? await Program.find({ _id: { $in: Array.from(programIds) } })
    : [];
  const programNameByEnrollment = new Map<string, string>();
  enrollments.forEach((e) => {
    const p = programs.find((pr) => pr._id.equals(e.programId));
    programNameByEnrollment.set(e._id.toString(), p?.name ?? '—');
  });

  const issuingUser = await User.findById(input.issuedByUserId);

  const buffers: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  doc.fontSize(16).font('Helvetica-Bold').text(env.RECEIPT_ORG_NAME, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').fillColor('#555').text(env.RECEIPT_ORG_ADDRESS, {
    align: 'center',
  });
  if (env.RECEIPT_ORG_GSTIN) {
    doc.moveDown(0.1);
    doc.fontSize(9).text(`GSTIN: ${env.RECEIPT_ORG_GSTIN}`, { align: 'center' });
  }
  doc.moveDown(0.8);
  doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text('Payment Receipt', {
    align: 'center',
  });
  doc.moveDown(0.8);

  const { receiptCode } = input;
  const left = 48;
  let { y } = doc;

  const lines: Array<[string, string]> = [
    ['Receipt #:', receiptCode],
    ['Date:', istStamp(nowUtc())],
    ['Student:', `${student.name}${student.code ? ` (${student.code})` : ''}`],
    ['Email:', student.email],
    ['Payment method:', payment.method.replace('_', ' ')],
    ['Reference:', payment.reference || '—'],
    ['Received by:', issuingUser?.name ?? '—'],
  ];
  doc.fontSize(10).font('Helvetica');
  for (const [label, value] of lines) {
    doc.font('Helvetica-Bold').text(label, left, y, { width: 130, continued: false });
    doc.font('Helvetica').text(value, left + 140, y, { width: 360 });
    y = doc.y + 2;
  }

  doc.moveDown(1);
  y = doc.y;
  doc.font('Helvetica-Bold').text('Allocation', left, y);
  y = doc.y + 4;
  doc.moveTo(left, y).lineTo(547, y).stroke();
  y += 6;
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Program', left, y, { width: 160 });
  doc.text('Installment', left + 170, y, { width: 220 });
  doc.text('Amount', left + 400, y, { width: 100, align: 'right' });
  y = doc.y + 2;
  doc.moveTo(left, y).lineTo(547, y).stroke();
  y += 4;
  doc.font('Helvetica');
  for (const alloc of payment.allocations) {
    const inst = installmentMap.get(alloc.installmentId.toString());
    const inv = inst ? invoiceMap.get(inst.invoiceId.toString()) : null;
    const programName = inv
      ? programNameByEnrollment.get(inv.enrollmentId.toString()) ?? '—'
      : '—';
    const instLabel = inst?.label ?? '—';
    const instRow = y;
    doc.text(programName, left, instRow, { width: 160 });
    doc.text(instLabel, left + 170, instRow, { width: 220 });
    doc.text(formatPaiseAsRupees(alloc.amountPaise), left + 400, instRow, {
      width: 100,
      align: 'right',
    });
    y = doc.y + 2;
  }

  doc.moveTo(left, y).lineTo(547, y).stroke();
  y += 6;
  doc.font('Helvetica-Bold').text('Total', left, y, { width: 400 });
  doc.text(formatPaiseAsRupees(payment.amountPaise), left + 400, y, {
    width: 100,
    align: 'right',
  });
  y = doc.y + 4;
  doc.font('Helvetica-Oblique').fontSize(9).text(paiseToIndianWords(payment.amountPaise), left, y, {
    width: 499,
  });

  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#777');
  doc.text(
    'System-generated receipt. For any queries, please raise a Finance ticket from your India Learns dashboard.',
    { align: 'left' },
  );
  doc.moveDown(0.2);
  doc.text(
    'This is a computer-generated document and does not require a signature.',
    { align: 'left' },
  );

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
  });
}

export async function persistReceipt(
  payment: HydratedPayment,
  ctx: ReceiptContext,
): Promise<HydratedReceipt> {
  const existing = await Receipt.findOne({ paymentId: payment._id });
  if (existing) return existing;

  const year = financialYearFor(payment.receivedAt);
  const code = await nextReceiptCode(year);
  const pdfBytes = await generateReceiptPdf(payment, {
    receiptCode: code,
    issuedByUserId: ctx.issuedByUserId,
  });

  const filename = `${code}.pdf`;
  const { url, key } = await getIntegrations().storage.upload({
    bytes: pdfBytes,
    filename,
    folder: 'receipts',
    contentType: 'application/pdf',
  });

  const receipt = await Receipt.create({
    code,
    paymentId: payment._id,
    studentId: payment.studentId,
    pdfUrl: url,
    pdfKey: key,
    issuedAt: payment.receivedAt,
    issuedByUserId: ctx.issuedByUserId,
  });

  await recordAudit({
    actorUserId: ctx.issuedByUserId,
    action: 'fees.receipt.issued',
    targetType: 'Receipt',
    targetId: receipt._id,
    after: receipt.toJSON(),
  });

  return receipt;
}

export async function getSignedReceiptUrl(
  receipt: HydratedReceipt,
  ttlSec = 3600,
): Promise<string> {
  return getIntegrations().storage.signedUrl(receipt.pdfKey, ttlSec);
}

export function toReceiptDto(doc: HydratedReceipt): ReceiptDto {
  return {
    id: doc._id.toString(),
    code: doc.code,
    paymentId: doc.paymentId.toString(),
    studentId: doc.studentId.toString(),
    pdfUrl: doc.pdfUrl,
    pdfKey: doc.pdfKey,
    issuedAt: doc.issuedAt.toISOString(),
    issuedByUserId: doc.issuedByUserId.toString(),
  };
}
