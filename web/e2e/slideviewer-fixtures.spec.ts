import { test, expect } from '@playwright/test';
import { asGrid, asLines, normalizeSlides, slideContent } from '../src/lib/slideShape.js';

/**
 * PR #15 regression — SlideViewer "s.map is not a function".
 *
 * The curriculum generator emits slide content in two shapes the
 * production fixtures actually use:
 *   - CHRP-style: content is an array of strings
 *   - Maths-Certification-style: content is a single string (sometimes
 *     newline-delimited)
 *
 * Pre-fix the viewer cast either to `string[]` and called `.map(...)`,
 * which crashed for the string case ("s.map is not a function"). The
 * normalisers in `web/src/lib/slideShape.ts` are the single source of
 * truth — render code calls them; this regression locks the contract so
 * we don't drift again.
 *
 * Run with: `npx playwright test slideviewer-fixtures` (no browser
 * needed — these are pure runtime checks).
 */

const MATHS_TITLE_SLIDE = {
  slideNumber: 1,
  slideType: 'title',
  title: 'Maths Certification',
  content: { type: 'title', title: 'Maths Certification', content: 'Welcome\nLet us begin.' },
  speakerNotes: 'Greet the cohort.',
};

const MATHS_BULLETS_SLIDE = {
  slideNumber: 2,
  slideType: 'bullets',
  title: 'Day one',
  content: { type: 'bullets', title: 'Day one', content: 'Goals\nAttendance\nQuiz' },
  speakerNotes: '',
};

const CHRP_BULLETS_SLIDE = {
  slideNumber: 3,
  slideType: 'bullets',
  title: 'Recruitment funnel',
  content: { type: 'bullets', title: 'Recruitment funnel', content: ['Source', 'Screen', 'Interview'] },
  speakerNotes: 'Walk through stages.',
};

const CHRP_TWO_COLUMN_SLIDE = {
  slideNumber: 4,
  slideType: 'two_column',
  title: 'Pros vs cons',
  content: {
    type: 'two_column',
    title: 'Pros vs cons',
    leftColumn: ['Faster', 'Cheaper'],
    rightColumn: ['Less control', 'Vendor lock'],
  },
  speakerNotes: '',
};

const CHRP_TABLE_SLIDE = {
  slideNumber: 5,
  slideType: 'table',
  title: 'Roles',
  content: {
    type: 'table',
    title: 'Roles',
    table: {
      headers: ['Role', 'Owner'],
      rows: [
        ['Trainer', 'A'],
        ['Examiner', 'B'],
      ],
    },
  },
  speakerNotes: '',
};

test.describe('SlideViewer fixture normalisation (PR #15 regression)', () => {
  test('Maths fixture: content as a newline-delimited string', () => {
    expect(asLines(MATHS_TITLE_SLIDE.content.content)).toEqual(['Welcome', 'Let us begin.']);
    expect(asLines(MATHS_BULLETS_SLIDE.content.content)).toEqual(['Goals', 'Attendance', 'Quiz']);
  });

  test('CHRP fixture: content as a string array', () => {
    expect(asLines(CHRP_BULLETS_SLIDE.content.content)).toEqual(['Source', 'Screen', 'Interview']);
  });

  test('two_column shape: both columns normalise', () => {
    const c = CHRP_TWO_COLUMN_SLIDE.content;
    expect(asLines(c.leftColumn)).toEqual(['Faster', 'Cheaper']);
    expect(asLines(c.rightColumn)).toEqual(['Less control', 'Vendor lock']);
  });

  test('table shape: headers + rows normalise without crashing', () => {
    const c = CHRP_TABLE_SLIDE.content;
    expect(asLines(c.table.headers)).toEqual(['Role', 'Owner']);
    expect(asGrid(c.table.rows)).toEqual([
      ['Trainer', 'A'],
      ['Examiner', 'B'],
    ]);
  });

  test('defensive: unexpected shapes degrade to empty array, never throw', () => {
    expect(asLines(null)).toEqual([]);
    expect(asLines(undefined)).toEqual([]);
    expect(asLines({ unexpected: true })).toEqual([]);
    expect(asLines(42)).toEqual([]);
    expect(asGrid(null)).toEqual([]);
    expect(asGrid('not-a-grid')).toEqual([]);
    // Mixed-shape grid: each row goes through asLines, so a stray string
    // row becomes a single-line row rather than blowing up.
    expect(asGrid([['a', 'b'], 'oops', ['c']])).toEqual([['a', 'b'], ['oops'], ['c']]);
  });

  test('regression: pre-fix shape ("content as string") would have crashed .map', () => {
    // Before PR #15 the SlideViewer ran `(c.content ?? []).map(...)` — a
    // string passed in here would throw `s.map is not a function`. The
    // normaliser converts it instead. Lock that conversion.
    const stringContent: unknown = 'one\ntwo\nthree';
    expect(() => asLines(stringContent)).not.toThrow();
    expect(asLines(stringContent)).toHaveLength(3);
  });
});

/**
 * Replace-deck crash regression — "Cannot read properties of undefined
 * (reading 'title')".
 *
 * A corrupt/foreign deck (e.g. a PowerPoint converted to JSON) used to be
 * stored verbatim and crash the viewer. `normalizeSlides` strips holes so
 * we never index an undefined slide, and `slideContent` resolves a slide's
 * content without throwing when it is missing. These are the runtime
 * backstops that pair with the backend `assertRenderableSlides` guard.
 */
test.describe('SlideViewer corrupt-deck resilience', () => {
  test('normalizeSlides: passes a clean array of slide objects through', () => {
    const deck = [MATHS_TITLE_SLIDE, MATHS_BULLETS_SLIDE];
    expect(normalizeSlides(deck)).toHaveLength(2);
  });

  test('normalizeSlides: unwraps the { slides: [...] } wrapper', () => {
    expect(normalizeSlides({ slides: [CHRP_BULLETS_SLIDE] })).toHaveLength(1);
  });

  test('normalizeSlides: drops null / primitive / nested-array holes', () => {
    const dirty: unknown = [
      MATHS_TITLE_SLIDE,
      null,
      undefined,
      'oops',
      42,
      ['nested'],
      CHRP_BULLETS_SLIDE,
    ];
    const out = normalizeSlides(dirty);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s && typeof s === 'object')).toBe(true);
  });

  test('normalizeSlides: non-array / non-wrapper input degrades to []', () => {
    expect(normalizeSlides(null)).toEqual([]);
    expect(normalizeSlides(undefined)).toEqual([]);
    expect(normalizeSlides('not a deck')).toEqual([]);
    expect(normalizeSlides({ foo: 'bar' })).toEqual([]);
    expect(normalizeSlides(123)).toEqual([]);
  });

  test('slideContent: returns the inner content object for a real slide', () => {
    expect(slideContent(MATHS_TITLE_SLIDE)).toMatchObject({ type: 'title' });
  });

  test('slideContent: returns {} (never throws) for corrupt / missing content', () => {
    expect(() => slideContent(undefined)).not.toThrow();
    expect(slideContent(undefined)).toEqual({});
    expect(slideContent(null)).toEqual({});
    // The exact corruption shape: a foreign object with no `content`.
    expect(slideContent({ id: 1, type: 'pptx-shape', data: {} })).toEqual({});
    // content present but the wrong type (array / string) → still safe.
    expect(slideContent({ content: ['a', 'b'] })).toEqual({});
    expect(slideContent({ content: 'plain string' })).toEqual({});
  });

  test('regression: reading .title off a corrupt deck does not throw', () => {
    const corrupt: unknown = [{ slideNumber: 1, slideType: 'x', title: 'No content' }];
    const slides = normalizeSlides(corrupt);
    expect(slides).toHaveLength(1);
    // Pre-fix this path threw "Cannot read properties of undefined (reading 'title')".
    expect(() => {
      const c = slideContent(slides[0]);
      return ((slides[0]?.title ?? (c as { title?: string }).title) ?? '').trim();
    }).not.toThrow();
  });
});
