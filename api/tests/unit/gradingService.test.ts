import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeCourse,
  makeExam,
  makeExamAttempt,
  makeProgram,
  makeRubric,
  makeUser,
} from '../helpers/factories.js';
import { gradeExamAttempt } from '../../src/services/gradingService.js';
import { HttpError } from '../../src/middleware/error.js';
import { ExamAttempt, type HydratedUser } from '../../src/models/index.js';

function authFor(user: HydratedUser) {
  return {
    userId: user._id,
    role: user.role,
    status: user.status,
    user,
  };
}

describe('gradingService.gradeExamAttempt', () => {
  useMongo();
  useIntegrationSpies();

  it('grades essay + recomputes totalScorePercent + notifies student', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      passingPercent: 50,
      questions: [
        {
          text: 'Mcq',
          kind: 'mcq_single',
          options: ['A', 'B'],
          correctIndices: [0],
          points: 4,
        },
        {
          text: 'Essay',
          kind: 'essay',
          points: 6,
        },
      ],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      answers: [{ questionIndex: 0, chosenIndices: [0] }],
      essayAnswers: [{ questionIndex: 1, text: 'My essay' }],
      mcqScorePercent: 100,
    });

    const graded = await gradeExamAttempt(
      authFor(faculty as unknown as HydratedUser),
      attempt._id.toString(),
      { grades: [{ questionIndex: 1, score: 5, comment: 'Solid' }] },
      { actorUserId: faculty._id },
    );

    // (4 + 5) / (4 + 6) = 90%
    expect(graded.totalScorePercent).toBe(90);
    expect(graded.passed).toBe(true);
    expect(graded.essayScorePercent).toBeCloseTo((5 / 6) * 100, 1);
    expect(graded.graderUserId?.toString()).toBe(faculty._id.toString());
    expect(graded.gradedAt).toBeTruthy();
  });

  it('rejects faculty not assigned to the course (403)', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const otherFaculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [otherFaculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [
        {
          text: 'E',
          kind: 'essay',
          points: 10,
        },
      ],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'x' }],
    });

    await expect(
      gradeExamAttempt(
        authFor(faculty as unknown as HydratedUser),
        attempt._id.toString(),
        { grades: [{ questionIndex: 0, score: 5, comment: '' }] },
        { actorUserId: faculty._id },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('is idempotent: re-grading rewrites the grades array cleanly', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'E', kind: 'essay', points: 10 }],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'ans' }],
    });

    await gradeExamAttempt(
      authFor(faculty as unknown as HydratedUser),
      attempt._id.toString(),
      { grades: [{ questionIndex: 0, score: 4, comment: 'v1' }] },
      { actorUserId: faculty._id },
    );
    const after = await gradeExamAttempt(
      authFor(faculty as unknown as HydratedUser),
      attempt._id.toString(),
      { grades: [{ questionIndex: 0, score: 9, comment: 'v2' }] },
      { actorUserId: faculty._id },
    );
    expect(after.grades.length).toBe(1);
    expect(after.grades[0]!.score).toBe(9);
    expect(after.grades[0]!.comment).toBe('v2');
    expect(after.totalScorePercent).toBe(90);
  });

  it('rejects grading an un-submitted attempt', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'E', kind: 'essay', points: 5 }],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: null, // not submitted
    });
    await expect(
      gradeExamAttempt(
        authFor(faculty as unknown as HydratedUser),
        attempt._id.toString(),
        { grades: [{ questionIndex: 0, score: 3, comment: '' }] },
        { actorUserId: faculty._id },
      ),
    ).rejects.toBeInstanceOf(HttpError);
    const reloaded = await ExamAttempt.findById(attempt._id);
    expect(reloaded!.grades.length).toBe(0);
  });

  it('enforces rubricScores length matches rubric criteria count', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const rubric = await makeRubric({
      courseId: course._id,
      criteria: [
        { label: 'Clarity', kind: 'numeric', maxScore: 5 },
        { label: 'Depth', kind: 'numeric', maxScore: 5 },
      ],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [
        {
          text: 'E',
          kind: 'essay',
          points: 10,
          rubricId: rubric._id,
        },
      ],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'x' }],
    });
    await expect(
      gradeExamAttempt(
        authFor(faculty as unknown as HydratedUser),
        attempt._id.toString(),
        {
          grades: [
            {
              questionIndex: 0,
              score: 8,
              comment: '',
              rubricScores: [
                { criterionIndex: 0, score: 4, label: null },
                // missing criterion 1
              ],
            },
          ],
        },
        { actorUserId: faculty._id },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});
