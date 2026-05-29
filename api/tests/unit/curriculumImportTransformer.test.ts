import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { WorkflowEnvelopeSchema } from '../../src/services/curriculumImport/schema.js';
import { transformWorkflow } from '../../src/services/curriculumImport/transformer.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../../../curriculum-import/sample-workflow-full.json');

describe('curriculum import transformer', () => {
  const envelope = JSON.parse(readFileSync(fixturePath, 'utf-8'));
  const parsed = WorkflowEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new Error(`Fixture failed Zod parse: ${parsed.error.message}`);
  }
  const wf = parsed.data.data;
  const out = transformWorkflow(wf);

  it('produces a course with workflow provenance', () => {
    expect(out.course.sourceWorkflowId).toBe(wf._id);
    expect(out.course.sourceWorkflowVersion).toBe(wf.updatedAt);
    expect(out.course.name).toBe('Maths Certification');
    expect(out.course.slug).toMatch(/^maths-certification-/);
  });

  it('maps every PLO into the course', () => {
    expect(out.course.programLearningOutcomes).toHaveLength(wf.step3?.outcomes?.length ?? 0);
    const first = out.course.programLearningOutcomes[0]!;
    expect(first.code).toMatch(/^PLO/);
    expect(first.statement.length).toBeGreaterThan(0);
  });

  it('maps every step4 module', () => {
    expect(out.modules).toHaveLength(wf.step4?.modules?.length ?? 0);
    const first = out.modules[0]!;
    expect(first.code).toMatch(/^MOD/);
    expect(first.coreElective).toBe('core'); // generator has no marker
    expect(first.aim).toBe(wf.step4!.modules![0]!.description); // mapped from description
  });

  it('renames competencyLinks to linkedKSCs on MLOs', () => {
    const generatorMLO = wf.step4!.modules![0]!.mlos![0]!;
    const transformed = out.modules[0]!.learningOutcomes[0]!;
    expect(transformed.linkedKSCs).toEqual(generatorMLO.competencyLinks);
  });

  it('produces one Session per generator lesson + one synthesized assessment session per module', () => {
    const totalLessons = (wf.step10?.moduleLessonPlans ?? []).reduce(
      (sum, p) => sum + p.lessons.length,
      0,
    );
    const moduleCount = (wf.step12?.moduleAssignmentPacks ?? []).length;
    // +1 summative session attached to last module
    const expected = totalLessons + moduleCount + 1;
    expect(out.sessions.length).toBe(expected);

    const synthesized = out.sessions.filter((s) => s.synthesized);
    expect(synthesized.length).toBe(moduleCount + 1);
  });

  it('produces a Material (slides) per PPT deck attached to the right session', () => {
    const totalDecks = (wf.step11?.modulePPTDecks ?? []).reduce(
      (sum, g) => sum + g.pptDecks.length,
      0,
    );
    const slideMaterials = out.materials.filter((m) => m.type === 'slides');
    expect(slideMaterials.length).toBe(totalDecks);

    const m = slideMaterials[0]!;
    expect(m.scope).toBe('session');
    expect(m.sessionKey).toBeTruthy();
    expect(Array.isArray(m.body)).toBe(true);
    expect((m.body as unknown[]).length).toBeGreaterThan(0);
    expect(m.slideCount).toBeGreaterThan(0);
  });

  it('produces 3 assignments per pack (variants) plus the summative', () => {
    const variantTotal = (wf.step12?.moduleAssignmentPacks ?? []).reduce((sum, p) => {
      const present = [p.variants.self_study, p.variants.hybrid, p.variants.in_person]
        .filter(Boolean).length;
      return sum + present;
    }, 0);
    expect(out.assignments.length).toBe(variantTotal + 1);
    const summative = out.assignments.find((a) => a.deliveryVariant === 'summative');
    expect(summative).toBeDefined();
    expect(summative!.maxScore).toBe(wf.step13!.overview!.totalMarks);
  });

  it('falls back to moduleCode-variant when assignmentId starts with "undefined"', () => {
    // The Maths Certification fixture has the known "undefined-<variant>" bug.
    const offending = out.assignments.filter((a) =>
      a.sourceAssignmentPackId.startsWith('undefined'),
    );
    expect(offending.length).toBe(0);
    // And we should have packs with the corrected `MOD###-variant` shape.
    const corrected = out.assignments.filter((a) =>
      /^MOD\d+-(self_study|hybrid|in_person)$/.test(a.sourceAssignmentPackId),
    );
    expect(corrected.length).toBeGreaterThan(0);
  });

  it('every assignment is attached to a session that exists', () => {
    const sessionKeys = new Set(out.sessions.map((s) => s.sessionKey));
    for (const a of out.assignments) {
      expect(sessionKeys.has(a.sessionKey)).toBe(true);
    }
  });

  it('every Material session-scope link points at a known session key', () => {
    const sessionKeys = new Set(out.sessions.map((s) => s.sessionKey));
    for (const m of out.materials) {
      if (m.scope === 'session') {
        expect(sessionKeys.has(m.sessionKey!)).toBe(true);
      }
    }
  });

  it('every session module key points at a known module', () => {
    const moduleKeys = new Set(out.modules.map((m) => m.key));
    for (const s of out.sessions) {
      expect(moduleKeys.has(s.moduleKey)).toBe(true);
    }
  });

  it('does not throw on the real workflow shape', () => {
    expect(out.warnings).toBeInstanceOf(Array);
  });

  // Logan: "Can we have the terms and reading lists automatically
  // transferred over from the generator?"
  it('auto-imports a course-level glossary from generator terminology', () => {
    expect(out.course.glossary.length).toBeGreaterThan(0);
    const e = out.course.glossary[0]!;
    expect(e.term.length).toBeGreaterThan(0);
    expect(e.definition.length).toBeGreaterThan(0);
    const terms = out.course.glossary.map((g) => g.term.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length); // deduped
  });

  it('auto-imports a course-level reading list from generator readings', () => {
    expect(out.course.readingList.length).toBeGreaterThan(0);
    expect(out.course.readingList[0]!.title.length).toBeGreaterThan(0);
  });

  it('attaches per-module glossary + reading list within field caps', () => {
    expect(out.modules.filter((m) => m.glossary.length > 0).length).toBeGreaterThan(0);
    expect(out.modules.filter((m) => m.readingList.length > 0).length).toBeGreaterThan(0);
    for (const m of out.modules) {
      for (const g of m.glossary) {
        expect(g.term.length).toBeLessThanOrEqual(200);
        expect(g.definition.length).toBeLessThanOrEqual(4000);
      }
      for (const r of m.readingList) {
        expect(r.title.length).toBeLessThanOrEqual(400);
        expect(r.url.length).toBeLessThanOrEqual(2048);
      }
    }
  });

  it('extracts a URL from reading citations when present', () => {
    const withUrl = out.modules
      .flatMap((m) => m.readingList)
      .filter((r) => r.url.startsWith('http'));
    expect(withUrl.length).toBeGreaterThan(0);
  });
});

// CHRP regression — found in UAT after Phase A shipped.
//
// The CHRP workflow surfaced two real-world generator quirks:
//   1. step10.moduleLessonPlans had DUPLICATE entries for mod5 and mod6
//      (each module's plan group appeared twice with the same 9 lessons).
//      Pre-fix, the persister tried to insert duplicate sourceLessonId
//      values, blew the unique sparse index on session #23, and silently
//      dropped every session after that — plus all materials and
//      assignments since they run after sessions.
//   2. The success card showed "Import successful · 0 / 0 / 0 / 0" on
//      the retry because the partial course existed and the persister's
//      no-op idempotent path matched.
//
// The transformer now dedupes step10/step11/step12 by their respective
// keys with a warning per skipped duplicate. Verified end-to-end against
// the CHRP fixture below.
describe('curriculum import transformer — CHRP regression', () => {
  const chrpPath = resolve(here, '../../../curriculum-import/sample-workflow-chrp.json');
  const env = JSON.parse(readFileSync(chrpPath, 'utf-8'));
  const parsed = WorkflowEnvelopeSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`CHRP fixture failed Zod parse: ${parsed.error.message}`);
  }
  const wf = parsed.data.data;
  const out = transformWorkflow(wf);

  it('parses cleanly + emits the CHRP course shape', () => {
    // Course name pulls from step1.programTitle when present.
    expect(out.course.name.length).toBeGreaterThan(0);
    expect(out.course.sourceWorkflowId).toBe(wf._id);
    expect(out.modules).toHaveLength(8);
  });

  it('post-dedup CHRP counts are stable', () => {
    // 60 lessons in step10 minus 9+9 duplicate (mod5+mod6) = 42 unique
    // lessons, plus one synthesized "Assessment" session per module (8)
    // + one synthesized "Final Exam" = 51 total sessions.
    expect(out.sessions).toHaveLength(51);
    expect(out.materials).toHaveLength(35);
    // 8 packs × 3 variants + 1 summative = 25.
    expect(out.assignments).toHaveLength(25);
  });

  it('dedupes the duplicate step10 module groups + warns about each', () => {
    // CHRP has mod5 and mod6 each appearing twice; we expect at least
    // two "Duplicate lesson-plan group" warnings.
    const dupePlanWarns = out.warnings.filter((w) =>
      w.startsWith('Duplicate lesson-plan group for module'),
    );
    expect(dupePlanWarns.length).toBeGreaterThanOrEqual(2);
  });

  it('produces unique sourceLessonIds across all sessions', () => {
    const ids = out.sessions
      .map((s) => s.sourceLessonId)
      .filter((id): id is string => typeof id === 'string');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces unique sourceDeckIds across all materials', () => {
    const ids = out.materials
      .map((m) => m.sourceDeckId)
      .filter((id): id is string => typeof id === 'string');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces unique sourceAssignmentPackIds across all assignments', () => {
    const ids = out.assignments.map((a) => a.sourceAssignmentPackId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every session.moduleKey resolves to a real module', () => {
    const moduleKeys = new Set(out.modules.map((m) => m.key));
    for (const s of out.sessions) {
      expect(moduleKeys.has(s.moduleKey)).toBe(true);
    }
  });

  it('every material.sessionKey resolves to a real session', () => {
    const sessionKeys = new Set(out.sessions.map((s) => s.sessionKey));
    for (const m of out.materials) {
      if (m.scope === 'session') {
        expect(sessionKeys.has(m.sessionKey!)).toBe(true);
      }
    }
  });

  it('every assignment.sessionKey resolves to a real session', () => {
    const sessionKeys = new Set(out.sessions.map((s) => s.sessionKey));
    for (const a of out.assignments) {
      expect(sessionKeys.has(a.sessionKey)).toBe(true);
    }
  });
});
