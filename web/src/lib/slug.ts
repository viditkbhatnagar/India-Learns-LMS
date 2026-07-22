/**
 * Client mirror of the API's `slugify` (api/src/utils/slug.ts). Turns a
 * human-typed name into a URL-friendly slug so the Slug field can auto-fill
 * from the Name and staff never have to hand-type hyphens. "Diploma in
 * Fashion & Retail Management" → "diploma-in-fashion-retail-management".
 */
export function slugify(raw: string): string {
  return (raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 160)
    .replace(/^-+|-+$/g, '');
}
