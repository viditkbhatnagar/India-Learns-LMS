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
});
