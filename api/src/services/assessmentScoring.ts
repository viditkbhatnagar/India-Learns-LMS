import type { QuizQuestionDoc } from '../models/quiz.js';
import type { ExamQuestionDoc } from '../models/exam.js';
import type { QuizAttemptAnswerDoc } from '../models/quizAttempt.js';
import type { ExamAttemptAnswerDoc } from '../models/examAttempt.js';

// Per Vidit's M7 clarification: MCQ grading is ALL-OR-NOTHING per question.
// `mcq_single`: the single chosen index must equal the single correct index.
// `mcq_multi`:  the chosen set must equal the correct set (same size, same
// members). Any deviation — partial, superset, or empty — scores 0.
// Skipped (empty chosenIndices) always scores 0 unless the question itself has
// no correct indices (an admin error; treated as 0 to be safe).

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sortedA.length; i += 1) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

export interface McqGradeResult {
  earned: number;
  total: number;
  mcqScorePercent: number;
}

export function gradeMcqAnswers(
  questions: Array<QuizQuestionDoc | ExamQuestionDoc>,
  answers: Array<QuizAttemptAnswerDoc | ExamAttemptAnswerDoc>,
): McqGradeResult {
  const byIndex = new Map<number, number[]>();
  answers.forEach((a) => {
    byIndex.set(a.questionIndex, [...a.chosenIndices]);
  });

  let earned = 0;
  let total = 0;
  questions.forEach((q, idx) => {
    if (q.kind === 'mcq_single' || q.kind === 'mcq_multi') {
      total += q.points;
      const chosen = byIndex.get(idx) ?? [];
      if (q.correctIndices.length === 0) return; // admin misconfiguration
      if (q.kind === 'mcq_single') {
        const correct = q.correctIndices[0];
        if (chosen.length === 1 && chosen[0] === correct) {
          earned += q.points;
        }
      } else if (setsEqual(chosen, q.correctIndices)) {
        earned += q.points;
      }
    }
  });

  const mcqScorePercent = total === 0 ? 100 : (earned / total) * 100;
  return { earned, total, mcqScorePercent };
}

export interface EssayTotals {
  essayEarned: number;
  essayTotal: number;
  allEssaysGraded: boolean;
}

export function computeEssayTotals(
  questions: ExamQuestionDoc[],
  grades: Array<{ questionIndex: number; score: number }>,
): EssayTotals {
  const gradeByIndex = new Map<number, number>();
  grades.forEach((g) => gradeByIndex.set(g.questionIndex, g.score));

  let essayEarned = 0;
  let essayTotal = 0;
  let allEssaysGraded = true;
  questions.forEach((q, idx) => {
    if (q.kind === 'essay') {
      essayTotal += q.points;
      const score = gradeByIndex.get(idx);
      if (score === undefined) {
        allEssaysGraded = false;
      } else {
        essayEarned += score;
      }
    }
  });
  return { essayEarned, essayTotal, allEssaysGraded };
}

export function computeTotalPercent(
  mcqEarned: number,
  mcqTotal: number,
  essayEarned: number,
  essayTotal: number,
): number {
  const total = mcqTotal + essayTotal;
  if (total === 0) return 100;
  return ((mcqEarned + essayEarned) / total) * 100;
}
