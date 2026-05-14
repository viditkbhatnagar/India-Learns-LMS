import type { TicketCategory } from 'india-learns-shared-types';
import { Counter } from '../models/index.js';

/**
 * Atomically bump the counter named `key` and return the new value.
 * Width parameter added in M5 so fee-side codes (INV/RCP/CN) can use 6 digits
 * while user codes stay at 4 (D-014).
 */
export async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.seq;
}

export function formatCode(
  prefix: string,
  year: number,
  seq: number,
  width = 4,
): string {
  return `${prefix}-${year}-${String(seq).padStart(width, '0')}`;
}

export async function nextUserCode(year: number): Promise<string> {
  const seq = await nextSeq(`user_code_${year}`);
  return formatCode('IL', year, seq, 4);
}

// Admissions M1 — APP-2026-00001 etc. Width 5 because application volume in
// Phase 1 is small but we want it visually distinct from student codes
// (IL-YYYY-NNNN, width 4) and from receipts (RCP, width 6).
export async function nextApplicationCode(year: number): Promise<string> {
  const seq = await nextSeq(`application_code_${year}`);
  return formatCode('APP', year, seq, 5);
}

export async function nextInvoiceCode(year: number): Promise<string> {
  const seq = await nextSeq(`invoice_code_${year}`);
  return formatCode('INV', year, seq, 6);
}

export async function nextReceiptCode(year: number): Promise<string> {
  const seq = await nextSeq(`receipt_code_${year}`);
  return formatCode('RCP', year, seq, 6);
}

export async function nextCreditNoteCode(year: number): Promise<string> {
  const seq = await nextSeq(`credit_note_code_${year}`);
  return formatCode('CN', year, seq, 6);
}

// CLAUDE.md §5 pins the ticket-code example as `TKT-ACAD-000045` — category
// prefix plus a 6-digit sequence. Per-category counters keep the sequence
// contiguous within a category and year, so admins reading a backlog don't
// see holes across categories.
export const TICKET_CATEGORY_PREFIX: Record<TicketCategory, string> = {
  academic: 'ACAD',
  administration: 'ADMIN',
  finance: 'FIN',
  technical: 'TECH',
  complaints: 'CMPL',
};

export async function nextTicketCode(
  category: TicketCategory,
  year: number,
): Promise<string> {
  const prefix = TICKET_CATEGORY_PREFIX[category];
  const seq = await nextSeq(`ticket_code_${year}_${prefix}`);
  // `formatCode` puts the year between prefix and seq; ticket codes drop the
  // year from the canonical display (TKT-ACAD-000045) so format inline here.
  return `TKT-${prefix}-${String(seq).padStart(6, '0')}`;
}

/** Round-robin counter for staff assignment within a role bucket. */
export async function nextRoutingSlot(bucket: string): Promise<number> {
  return nextSeq(`ticket_rr_${bucket}`);
}
