import { z } from 'zod';

// Combining diacritical marks (U+0300–U+036F) left behind by NFKD decomposition.
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Turn a human-typed label into a URL-friendly slug: lowercase, accents
 * stripped, every run of non-alphanumerics collapsed to a single hyphen, no
 * leading/trailing hyphen. e.g. "Diploma in Fashion & Retail Management" →
 * "diploma-in-fashion-retail-management", "retail management-diploma" →
 * "retail-management-diploma".
 */
export function slugify(raw: string): string {
  return (raw ?? '')
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 160)
    .replace(/^-+|-+$/g, '');
}

/**
 * Zod schema that accepts a loosely-typed slug and stores a clean one. Replaces
 * the old strict `^[a-z0-9-]+$` regex so a value with spaces or capitals (what
 * staff actually type) is normalized instead of bouncing as "Request failed
 * validation". Fails only when there isn't a single letter/number to keep.
 */
export const slugSchema = z.string().transform((val, ctx) => {
  const slug = slugify(val);
  if (!slug) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a slug (or name) with at least one letter or number.',
    });
    return z.NEVER;
  }
  return slug;
});
