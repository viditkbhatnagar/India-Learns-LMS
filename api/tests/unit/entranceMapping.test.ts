import { describe, expect, it } from 'vitest';
import {
  attemptDeadline,
  computeAutoScore,
  manualPossibleMarks,
} from '../../src/services/entrance/entranceMapping.js';

const exam = {
  questions: [
    { section: 'A', text: 'Q1', kind: 'mcq' as const, options: ['x', 'y'], correctIndex: 1, points: 1 },
    { section: 'A', text: 'Q2', kind: 'mcq' as const, options: ['x', 'y'], correctIndex: 0, points: 1 },
    { section: 'B', text: 'Q3 written', kind: 'text' as const, options: [], correctIndex: null, points: 1 },
  ],
};

function ans(questionIndex: number, selectedIndex: number | null, textAnswer = '') {
  return { questionIndex, selectedIndex, textAnswer, answeredAt: null };
}

describe('entranceMapping.computeAutoScore', () => {
  it('awards points only for correct MCQ selections', () => {
    const r = computeAutoScore(exam, [ans(0, 1), ans(1, 1), ans(2, null, 'hi')]);
    expect(r.autoScoreMarks).toBe(1); // Q1 correct, Q2 wrong
    expect(r.hasTextQuestions).toBe(true);
  });

  it('ignores text questions and unanswered MCQs', () => {
    const r = computeAutoScore(exam, [ans(1, 0)]);
    expect(r.autoScoreMarks).toBe(1); // only Q2 answered + correct
  });

  it('gives zero when nothing matches', () => {
    const r = computeAutoScore(exam, [ans(0, 0), ans(1, 1)]);
    expect(r.autoScoreMarks).toBe(0);
  });
});

describe('entranceMapping.manualPossibleMarks', () => {
  it('sums points of text questions only', () => {
    expect(manualPossibleMarks(exam)).toBe(1);
  });
});

describe('entranceMapping.attemptDeadline', () => {
  it('adds the duration to the start time', () => {
    const start = new Date('2026-07-10T04:30:00.000Z');
    const deadline = attemptDeadline(start, 45);
    expect(deadline.toISOString()).toBe('2026-07-10T05:15:00.000Z');
  });
});
