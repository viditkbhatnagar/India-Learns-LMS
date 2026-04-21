import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import {
  nextCreditNoteCode,
  nextInvoiceCode,
  nextReceiptCode,
  nextRoutingSlot,
  nextTicketCode,
  nextUserCode,
} from '../../src/services/counterService.js';

describe('counterService.nextUserCode', () => {
  useMongo();

  it('produces monotonically increasing zero-padded codes per year', async () => {
    const a = await nextUserCode(2026);
    const b = await nextUserCode(2026);
    const c = await nextUserCode(2027);
    expect(a).toBe('IL-2026-0001');
    expect(b).toBe('IL-2026-0002');
    expect(c).toBe('IL-2027-0001');
  });

  it('returns distinct values under concurrent calls', async () => {
    const count = 20;
    const codes = await Promise.all(
      Array.from({ length: count }, () => nextUserCode(2030)),
    );
    const unique = new Set(codes);
    expect(unique.size).toBe(count);
    for (const code of codes) {
      expect(code).toMatch(/^IL-2030-\d{4}$/);
    }
  });
});

describe('counterService fee-side codes', () => {
  useMongo();

  it('nextInvoiceCode produces 6-digit zero-padded INV codes per year', async () => {
    const a = await nextInvoiceCode(2026);
    const b = await nextInvoiceCode(2026);
    expect(a).toBe('INV-2026-000001');
    expect(b).toBe('INV-2026-000002');
  });

  it('nextReceiptCode produces 6-digit RCP codes', async () => {
    const a = await nextReceiptCode(2026);
    expect(a).toMatch(/^RCP-2026-\d{6}$/);
  });

  it('nextCreditNoteCode produces 6-digit CN codes', async () => {
    const a = await nextCreditNoteCode(2026);
    expect(a).toMatch(/^CN-2026-\d{6}$/);
  });

  it('user + invoice counters do not collide', async () => {
    const u = await nextUserCode(2099);
    const i = await nextInvoiceCode(2099);
    expect(u).toBe('IL-2099-0001');
    expect(i).toBe('INV-2099-000001');
  });
});

describe('counterService ticket codes', () => {
  useMongo();

  it('nextTicketCode uses the category-specific prefix (ACAD) with 6-digit padding', async () => {
    const a = await nextTicketCode('academic', 2026);
    const b = await nextTicketCode('academic', 2026);
    expect(a).toBe('TKT-ACAD-000001');
    expect(b).toBe('TKT-ACAD-000002');
  });

  it('ticket-code counters are isolated across categories', async () => {
    const acad = await nextTicketCode('academic', 2026);
    const fin = await nextTicketCode('finance', 2026);
    const cmpl = await nextTicketCode('complaints', 2026);
    expect(acad).toBe('TKT-ACAD-000001');
    expect(fin).toBe('TKT-FIN-000001');
    expect(cmpl).toBe('TKT-CMPL-000001');
  });

  it('routing slot increments monotonically per bucket', async () => {
    const a = await nextRoutingSlot('admin_ops');
    const b = await nextRoutingSlot('admin_ops');
    const c = await nextRoutingSlot('finance');
    expect(b - a).toBe(1);
    expect(c).toBe(1);
  });
});
