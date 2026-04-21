import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import {
  computeEssayTotals,
  computeTotalPercent,
  gradeMcqAnswers,
} from '../../src/services/assessmentScoring.js';
import type { QuizQuestionDoc } from '../../src/models/quiz.js';
import type { ExamQuestionDoc } from '../../src/models/exam.js';

const quizQuestions: QuizQuestionDoc[] = [
  {
    text: 'Single: 2+2?',
    kind: 'mcq_single',
    options: ['3', '4', '5', '22'],
    correctIndices: [1],
    points: 2,
  },
  {
    text: 'Multi: primes under 10',
    kind: 'mcq_multi',
    options: ['2', '3', '4', '5'],
    correctIndices: [0, 1, 3],
    points: 3,
  },
];

describe('gradeMcqAnswers — quiz', () => {
  it('full credit on happy path (exact match, including multi set equality)', () => {
    const result = gradeMcqAnswers(quizQuestions, [
      { questionIndex: 0, chosenIndices: [1] },
      { questionIndex: 1, chosenIndices: [0, 1, 3] },
    ]);
    expect(result.earned).toBe(5);
    expect(result.total).toBe(5);
    expect(result.mcqScorePercent).toBe(100);
  });

  it('zero on "tie" — partial multi-select (subset + missing)', () => {
    const result = gradeMcqAnswers(quizQuestions, [
      { questionIndex: 0, chosenIndices: [1] },
      { questionIndex: 1, chosenIndices: [0, 1] }, // missing index 3
    ]);
    // single correct (2pts), multi partial (0pts)
    expect(result.earned).toBe(2);
    expect(result.total).toBe(5);
    expect(result.mcqScorePercent).toBe(40);
  });

  it('zero when multi has a wrong extra pick even if all correct included', () => {
    const result = gradeMcqAnswers(quizQuestions, [
      { questionIndex: 0, chosenIndices: [1] },
      { questionIndex: 1, chosenIndices: [0, 1, 2, 3] }, // added wrong idx 2
    ]);
    expect(result.earned).toBe(2);
    expect(result.mcqScorePercent).toBe(40);
  });

  it('zero on skip-all (no answers submitted)', () => {
    const result = gradeMcqAnswers(quizQuestions, []);
    expect(result.earned).toBe(0);
    expect(result.total).toBe(5);
    expect(result.mcqScorePercent).toBe(0);
  });

  it('ignores out-of-range answer indices without blowing up', () => {
    const result = gradeMcqAnswers(quizQuestions, [
      { questionIndex: 99, chosenIndices: [0, 1] },
      { questionIndex: 0, chosenIndices: [1] },
    ]);
    expect(result.earned).toBe(2);
  });

  it('single-correct with multi-pick chosen scores 0 (violates single contract)', () => {
    const result = gradeMcqAnswers(quizQuestions, [
      { questionIndex: 0, chosenIndices: [1, 2] },
    ]);
    expect(result.earned).toBe(0);
  });
});

describe('gradeMcqAnswers — exam (essay questions skipped)', () => {
  const examQuestions: ExamQuestionDoc[] = [
    {
      text: 'Capital?',
      kind: 'mcq_single',
      options: ['A', 'B'],
      correctIndices: [1],
      points: 2,
      rubricId: null,
      wordLimit: null,
    },
    {
      text: 'Discuss ATC procedures',
      kind: 'essay',
      options: [],
      correctIndices: [],
      points: 8,
      rubricId: null,
      wordLimit: 500,
    },
  ];

  it('only scores MCQ portion; essay total excluded from MCQ totals', () => {
    const result = gradeMcqAnswers(examQuestions, [
      { questionIndex: 0, chosenIndices: [1] },
    ]);
    expect(result.earned).toBe(2);
    expect(result.total).toBe(2);
    expect(result.mcqScorePercent).toBe(100);
  });
});

describe('computeEssayTotals', () => {
  const examQuestions: ExamQuestionDoc[] = [
    {
      text: 'Q1',
      kind: 'mcq_single',
      options: ['A', 'B'],
      correctIndices: [0],
      points: 2,
      rubricId: null,
      wordLimit: null,
    },
    {
      text: 'Essay',
      kind: 'essay',
      options: [],
      correctIndices: [],
      points: 10,
      rubricId: null,
      wordLimit: null,
    },
  ];

  it('returns earned/total and all-graded flag', () => {
    const r = computeEssayTotals(examQuestions, [{ questionIndex: 1, score: 7 }]);
    expect(r.essayEarned).toBe(7);
    expect(r.essayTotal).toBe(10);
    expect(r.allEssaysGraded).toBe(true);
  });

  it('flags not-all-graded when an essay is missing a grade', () => {
    const r = computeEssayTotals(examQuestions, []);
    expect(r.essayEarned).toBe(0);
    expect(r.essayTotal).toBe(10);
    expect(r.allEssaysGraded).toBe(false);
  });
});

describe('computeTotalPercent', () => {
  it('blends MCQ + essay points over combined total', () => {
    expect(computeTotalPercent(4, 6, 6, 10)).toBeCloseTo(62.5);
  });
  it('handles zero total defensively (100%)', () => {
    expect(computeTotalPercent(0, 0, 0, 0)).toBe(100);
  });
});
