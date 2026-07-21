import { z } from 'zod';

/**
 * Normalize a loosely-typed phone number to strict E.164 (`+<digits>`), or
 * return null if it can't be. India-first: a bare 10-digit national number
 * (what people here actually type, e.g. `9249551757`) becomes
 * `+919249551757`. Already-E.164 (`+91…`), `00`-international, a leading
 * domestic `0`, and a `91`-prefixed 12-digit form are all handled. Anything
 * else (too short, letters, wrong length) returns null.
 */
export function normalizeE164Loose(raw: string): string | null {
  const cleaned = (raw ?? '').replace(/[\s().-]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) {
    return /^\+\d{6,15}$/.test(cleaned) ? cleaned : null;
  }
  if (cleaned.startsWith('00')) {
    const intl = `+${cleaned.slice(2)}`;
    return /^\+\d{6,15}$/.test(intl) ? intl : null;
  }
  const digits = cleaned.replace(/\D/g, '').replace(/^0+/, '');
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return null;
}

/**
 * Zod schema that accepts human phone input and stores strict E.164. Replaces
 * the old strict `+`-required regex so India users can type a 10-digit number.
 */
export const phoneE164Schema = z.string().transform((val, ctx) => {
  const normalized = normalizeE164Loose(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid phone number — a 10-digit mobile number or +country code, e.g. +919812345678.',
    });
    return z.NEVER;
  }
  return normalized;
});
