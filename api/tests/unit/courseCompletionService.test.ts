import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeExam,
  makeExamAttempt,
  makeModule,
  makeProgram,
  makeQuiz,
  makeQuizAttempt,
  makeUser,
} from '../helpers/factories.js';
import { checkAndMaybePublish } from '../../src/services/courseCompletionService.js';
import { DomainEvent, Enrollment } from '../../src/models/index.js';

describe('courseCompletionService.checkAndMaybePublish', () => {
  useMongo();
  useIntegrationSpies();

  async function setupEnrolment() {
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
    });
    const batch = await makeBatch({ programId: program._id, status: 'active' });
    const enrolment = await makeEnrollment({
      studentId: student._id,
      programId: program._id,
      batchId: batch._id,
      courseId: course._id,
    });
    const moduleA = await makeModule({ courseId: course._id, order: 0 });
    const moduleB = await makeModule({ courseId: course._id, order: 1 });
    return { student, program, course, batch, enrolment, moduleA, moduleB };
  }

  it('does not fire when no exam exists even if quizzes are passed', async () => {
    const { student, enrolment, moduleA } = await setupEnrolment();
    const quiz = await makeQuiz({ moduleId: moduleA._id });
    await makeQuizAttempt({
      quizId: quiz._id,
      studentId: student._id,
      submittedAt: new Date(),
      scorePercent: 100,
      passed: true,
    });
    const result = await checkAndMaybePublish(enrolment._id);
    expect(result.completed).toBe(false);
    const events = await DomainEvent.countDocuments({ type: 'course.completed' });
    expect(events).toBe(0);
  });

  it('does not fire when any quiz is not passed', async () => {
    const { student, enrolment, course, moduleA, moduleB } = await setupEnrolment();
    const qA = await makeQuiz({ moduleId: moduleA._id });
    const qB = await makeQuiz({ moduleId: moduleB._id });
    await makeQuizAttempt({
      quizId: qA._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: true,
      scorePercent: 90,
    });
    // qB not passed
    await makeQuizAttempt({
      quizId: qB._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: false,
      scorePercent: 30,
    });
    const exam = await makeExam({ courseId: course._id });
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: true,
      totalScorePercent: 80,
    });
    const result = await checkAndMaybePublish(enrolment._id);
    expect(result.completed).toBe(false);
  });

  it('fires exactly once when all predicates are satisfied; idempotent on re-check', async () => {
    const { student, enrolment, course, moduleA, moduleB } = await setupEnrolment();
    const qA = await makeQuiz({ moduleId: moduleA._id });
    const qB = await makeQuiz({ moduleId: moduleB._id });
    await makeQuizAttempt({
      quizId: qA._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: true,
      scorePercent: 80,
    });
    await makeQuizAttempt({
      quizId: qB._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: true,
      scorePercent: 85,
    });
    const exam = await makeExam({ courseId: course._id });
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      passed: true,
      totalScorePercent: 75,
    });

    const first = await checkAndMaybePublish(enrolment._id);
    expect(first.completed).toBe(true);
    expect(first.alreadyCompleted).toBe(false);

    const reloaded = await Enrollment.findById(enrolment._id);
    expect(reloaded!.completed).toBe(true);
    expect(reloaded!.completedAt).toBeTruthy();

    const second = await checkAndMaybePublish(enrolment._id);
    expect(second.alreadyCompleted).toBe(true);

    const events = await DomainEvent.find({ type: 'course.completed' });
    expect(events.length).toBe(1);
    expect(events[0]!.payload).toMatchObject({
      enrolmentId: enrolment._id.toString(),
      studentId: student._id.toString(),
      courseId: course._id.toString(),
    });
  });
});
