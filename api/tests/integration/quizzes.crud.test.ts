import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeModule,
  makeProgram,
  makeQuiz,
  makeStudent,
  makeUser,
} from '../helpers/factories.js';

describe('quizzes + quiz-attempts routes', () => {
  useMongo();
  useIntegrationSpies();

  async function setupCourseAndStudent() {
    const { user: faculty } = await makeFaculty();
    const { user: student } = await makeStudent();
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id, status: 'active' });
    await makeEnrollment({
      studentId: student._id,
      programId: program._id,
      batchId: batch._id,
      courseId: course._id,
    });
    const moduleDoc = await makeModule({ courseId: course._id, order: 0 });
    return { faculty, student, program, course, moduleDoc };
  }

  it('faculty creates a quiz and student attempts → submits → passes', async () => {
    const { faculty, student, moduleDoc } = await setupCourseAndStudent();
    const fAt = await tokenFor(faculty);
    const create = await http()
      .post('/v1/quizzes')
      .set(bearer(fAt))
      .send({
        moduleId: String(moduleDoc._id),
        title: 'Module 1 Quiz',
        maxAttempts: 2,
        passingPercent: 60,
        questions: [
          {
            text: 'Single',
            kind: 'mcq_single',
            options: ['A', 'B', 'C'],
            correctIndices: [1],
            points: 3,
          },
          {
            text: 'Multi',
            kind: 'mcq_multi',
            options: ['W', 'X', 'Y', 'Z'],
            correctIndices: [0, 2],
            points: 3,
          },
        ],
      });
    expect(create.status).toBe(201);
    const quizId = create.body.data.quiz.id;

    // Publish → live
    const pub = await http()
      .patch(`/v1/quizzes/${quizId}`)
      .set(bearer(fAt))
      .send({ state: 'live' });
    expect(pub.status).toBe(200);
    expect(pub.body.data.quiz.state).toBe('live');

    // Student starts attempt
    const sAt = await tokenFor(student);
    const start = await http()
      .post(`/v1/quizzes/${quizId}/attempt`)
      .set(bearer(sAt))
      .send({});
    expect(start.status).toBe(201);
    const attemptId = start.body.data.attempt.id;

    // Submit all correct
    const submit = await http()
      .post(`/v1/quiz-attempts/${attemptId}/submit`)
      .set(bearer(sAt))
      .send({
        answers: [
          { questionIndex: 0, chosenIndices: [1] },
          { questionIndex: 1, chosenIndices: [0, 2] },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.attempt.scorePercent).toBe(100);
    expect(submit.body.data.attempt.passed).toBe(true);
  });

  it('"tie" multi-select scores 0 on that question; under passingPercent fails', async () => {
    const { faculty, student, moduleDoc } = await setupCourseAndStudent();
    const fAt = await tokenFor(faculty);
    const create = await http()
      .post('/v1/quizzes')
      .set(bearer(fAt))
      .send({
        moduleId: String(moduleDoc._id),
        title: 'Partial',
        passingPercent: 80,
        questions: [
          {
            text: 'Multi',
            kind: 'mcq_multi',
            options: ['A', 'B', 'C'],
            correctIndices: [0, 1],
            points: 10,
          },
        ],
      });
    const quizId = create.body.data.quiz.id;
    await http()
      .patch(`/v1/quizzes/${quizId}`)
      .set(bearer(fAt))
      .send({ state: 'live' });

    const sAt = await tokenFor(student);
    const start = await http()
      .post(`/v1/quizzes/${quizId}/attempt`)
      .set(bearer(sAt))
      .send({});
    const attemptId = start.body.data.attempt.id;

    const submit = await http()
      .post(`/v1/quiz-attempts/${attemptId}/submit`)
      .set(bearer(sAt))
      .send({
        answers: [{ questionIndex: 0, chosenIndices: [0] }], // partial
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.attempt.scorePercent).toBe(0);
    expect(submit.body.data.attempt.passed).toBe(false);
  });

  it('enforces maxAttempts (409 ASSESSMENT_ATTEMPTS_EXHAUSTED on over-limit)', async () => {
    const { faculty, student, moduleDoc } = await setupCourseAndStudent();
    const quiz = await makeQuiz({
      moduleId: moduleDoc._id,
      maxAttempts: 1,
      state: 'live',
    });
    const sAt = await tokenFor(student);
    const first = await http()
      .post(`/v1/quizzes/${String(quiz._id)}/attempt`)
      .set(bearer(sAt))
      .send({});
    expect(first.status).toBe(201);
    const attemptId = first.body.data.attempt.id;
    const submit = await http()
      .post(`/v1/quiz-attempts/${attemptId}/submit`)
      .set(bearer(sAt))
      .send({ answers: [] });
    expect(submit.status).toBe(200);

    const second = await http()
      .post(`/v1/quizzes/${String(quiz._id)}/attempt`)
      .set(bearer(sAt))
      .send({});
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ASSESSMENT_ATTEMPTS_EXHAUSTED');
    // Silence unused faculty warning — fixture stands for the role matrix.
    expect(faculty).toBeTruthy();
  });

  it('student cannot view a quiz while in draft state', async () => {
    const { student, moduleDoc } = await setupCourseAndStudent();
    const quiz = await makeQuiz({
      moduleId: moduleDoc._id,
      state: 'draft',
    });
    const sAt = await tokenFor(student);
    const res = await http()
      .get(`/v1/quizzes/${String(quiz._id)}`)
      .set(bearer(sAt));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ASSESSMENT_NOT_LIVE');
  });

  it('student not enrolled in the course cannot start an attempt (403)', async () => {
    const { faculty, moduleDoc } = await setupCourseAndStudent();
    const quiz = await makeQuiz({ moduleId: moduleDoc._id, state: 'live' });
    const other = await makeUser({ role: 'student' });
    const sAt = await tokenFor(other);
    const res = await http()
      .post(`/v1/quizzes/${String(quiz._id)}/attempt`)
      .set(bearer(sAt))
      .send({});
    expect(res.status).toBe(403);
    // faculty fixture parked to keep setup reusable.
    expect(faculty).toBeTruthy();
  });

  it('faculty not assigned to the course cannot create a quiz (403)', async () => {
    const { moduleDoc } = await setupCourseAndStudent();
    const { user: otherFaculty } = await makeFaculty();
    const at = await tokenFor(otherFaculty);
    const res = await http()
      .post('/v1/quizzes')
      .set(bearer(at))
      .send({
        moduleId: String(moduleDoc._id),
        title: 'Hijack',
        questions: [
          {
            text: 'Q',
            kind: 'mcq_single',
            options: ['A', 'B'],
            correctIndices: [0],
            points: 1,
          },
        ],
      });
    expect(res.status).toBe(403);
  });
});
