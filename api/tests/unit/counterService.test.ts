import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { nextUserCode } from '../../src/services/counterService.js';

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
