import { describe, expect, it } from 'vitest';
import { parseLessonPlan } from '../../src/services/curriculumImport/lessonPlanParser.js';

describe('parseLessonPlan', () => {
  it('parses MOD/M module headings + lessons, groups them, and ignores MLO codes in bodies', () => {
    const text = [
      '10.3 Module Lesson Plans',
      'MOD101: Foundations',
      'Lesson 1: Intro to retail',
      'Duration: 90 minutes | Bloom Level: understand',
      'M1-LO1: a module-outcome code that must NOT become a module',
      'Some objective text',
      'Lesson 2: Second lesson',
      'body line',
      'M2: Second Module',
      'Lesson 1: Fresh start in module two',
      'more body',
    ].join('\n');

    const out = parseLessonPlan(text);
    expect(out.modules).toHaveLength(2);
    expect(out.modules[0]!.title).toBe('Foundations');
    expect(out.modules[0]!.lessons).toHaveLength(2);
    expect(out.modules[0]!.lessons[0]!.title).toBe('Intro to retail');
    expect(out.modules[0]!.lessons[0]!.plannedMinutes).toBe(90);
    // the M1-LO1 line stays in the lesson body — it is NOT treated as a module
    expect(out.modules[0]!.lessons[0]!.description).toContain('module-outcome code');
    expect(out.modules[1]!.title).toBe('Second Module');
    expect(out.modules[1]!.lessons).toHaveLength(1);
  });

  it('ignores everything before the "Module Lesson Plans" section', () => {
    const text = [
      'Total Lessons 5',
      'Lesson 99: a summary-table row that should be ignored',
      'Module Lesson Plans',
      'MOD1: A',
      'Lesson 1: real',
    ].join('\n');
    const out = parseLessonPlan(text);
    expect(out.modules).toHaveLength(1);
    expect(out.modules[0]!.lessons).toHaveLength(1);
    expect(out.modules[0]!.lessons[0]!.title).toBe('real');
  });
});
