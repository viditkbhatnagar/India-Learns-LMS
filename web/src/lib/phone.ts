/**
 * Client-side mirror of the API's `normalizeE164Loose` (api/src/utils/phone.ts).
 * India-first: a bare 10-digit mobile (what people actually type, e.g.
 * `9876543210`) becomes `+919876543210`. Already-E.164 (`+91…`), `00`-intl, a
 * leading domestic `0`, and a `91`-prefixed 12-digit form are all handled.
 * Returns null for anything that can't be a phone number. Normalizing before
 * we POST means a valid 10-digit entry never bounces off the server as invalid.
 */
export function normalizePhoneLoose(raw: string): string | null {
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

/** Copy shown next to phone inputs — accepts either 10-digit or +country code. */
export const PHONE_HINT = 'A 10-digit mobile number, or +country code (e.g. +919876543210).';
