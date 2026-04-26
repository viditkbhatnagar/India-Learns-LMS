/**
 * Defensive normalisation for the curriculum-generator slide payload.
 *
 * The generator emits slide content as either:
 *   - an array of strings (CHRP fixture, "bullets"/"two_column"/"title"
 *     in most cases)
 *   - a single string with embedded newlines (Maths Certification
 *     fixture, legacy "title" slides)
 *   - an object/missing/etc. (rare, defensive default)
 *
 * Pre-PR-#15 the SlideViewer cast every shape to `string[]` and called
 * `.map(...)` — `s.map is not a function` for the string case. These
 * helpers are the single source of truth for "turn this into the array
 * we can render"; both the runtime and any Playwright regression test
 * exercise the same normaliser.
 */
export function asLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v ?? '')));
  }
  if (typeof value === 'string') {
    return value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function asGrid(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => asLines(row));
}
