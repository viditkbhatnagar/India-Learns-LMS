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
