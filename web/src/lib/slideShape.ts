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

/** A persisted slide, normalised to a safe object. Fields are optional
 * because the renderer must tolerate partial/legacy/corrupt decks without
 * throwing — `slideContent()` resolves the inner content defensively. */
export interface NormalizedSlide {
  slideNumber?: number;
  slideType?: string;
  title?: string | null;
  content?: unknown;
  speakerNotes?: string | null;
  [k: string]: unknown;
}

/**
 * Normalise a persisted material `body` into a clean slide array.
 *
 * Accepts the two shapes the generator/import emit — a bare array, or a
 * `{ slides: [...] }` wrapper (older Maths fixtures) — and drops any
 * null / non-object / nested-array holes so the viewer can never
 * dereference an `undefined` slide. This is the runtime backstop that
 * pairs with the backend `assertRenderableSlides` validation: even if a
 * corrupt deck is already stored, the viewer degrades gracefully instead
 * of white-screening. Single source of truth — the viewer and the
 * "Download deck" affordance both call this.
 */
export function normalizeSlides(body: unknown): NormalizedSlide[] {
  const raw: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { slides?: unknown }).slides)
      ? (body as { slides: unknown[] }).slides
      : [];
  return raw.filter(
    (s): s is NormalizedSlide => Boolean(s) && typeof s === 'object' && !Array.isArray(s),
  );
}

/**
 * Safely resolve a slide's `content` object. Returns `{}` for a missing,
 * null, non-object, or array content so callers can read `.type` / `.title`
 * without throwing `Cannot read properties of undefined (reading 'title')`
 * — the exact crash a corrupt deck used to cause in the slide viewer.
 */
export function slideContent(slide: unknown): Record<string, unknown> {
  if (!slide || typeof slide !== 'object') return {};
  const c = (slide as { content?: unknown }).content;
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}
