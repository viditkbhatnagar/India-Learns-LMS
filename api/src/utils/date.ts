import { z } from 'zod';

/**
 * Accepts a date the way a browser `<input type="date">` emits it
 * (`YYYY-MM-DD`) OR a full ISO datetime, and normalizes to an ISO datetime
 * string. Replaces a bare `z.string().datetime()`, which rejects the
 * date-only value the pickers actually send — that mismatch surfaced to
 * users as the generic "Request failed validation" (e.g. creating a batch).
 */
export const flexibleDateSchema = z.string().transform((val, ctx) => {
  const s = (val ?? '').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  if (!s || Number.isNaN(d.valueOf())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid date.',
    });
    return z.NEVER;
  }
  return d.toISOString();
});
