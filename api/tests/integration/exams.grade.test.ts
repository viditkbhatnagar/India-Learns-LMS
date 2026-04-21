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
  makeExam,
  makeExamAttempt,
  makeFaculty,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { Notification } from '../../src/models/index.js';

describe('exams — student submit + faculty grade', () => {
  useMongo();
  useIntegrationSpies();

  async function setup() {
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
    return { faculty, student, course };
  }

  it('student submits mixed exam → MCQ auto-graded, essay pending', async () => {
    const { student, course } = await setup();
    const exam = await makeExam({
      courseId: course._id,
      passingPercent: 50,
      questions: [
        {
          text: 'Q1',
          kind: 'mcq_single',
          options: ['A', 'B'],
          correctIndices: [1],
          points: 4,
        },
        { text: 'Essay', kind: 'essay', points: 6 },
      ],
    });
    const sAt = await tokenFor(student);
    const start = await http()
      .post(`/v1/exams/${String(exam._id)}/attempt`)
      .set(bearer(sAt))
      .send({});
    expect(start.status).toBe(201);
    const attemptId = start.body.data.attempt.id;

    const submit = await http()
      .post(`/v1/exam-attempts/${attemptId}/submit`)
      .set(bearer(sAt))
      .send({
        answers: [{ questionIndex: 0, chosenIndices: [1] }],
        essayAnswers: [{ questionIndex: 1, text: 'Essay body' }],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.attempt.mcqScorePercent).toBe(100);
    expect(submit.body.data.attempt.totalScorePercent).toBeNull();
    expect(submit.body.data.attempt.passed).toBeNull();
  });

  it('faculty grades essay → totalScorePercent set, student notified', async () => {
    const { faculty, student, course } = await setup();
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
        { text: 'Essay', kind: 'essay', points: 6 },
      ],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      answers: [{ questionIndex: 0, chosenIndices: [0] }],
      essayAnswers: [{ questionIndex: 1, text: 'essay' }],
      mcqScorePercent: 100,
    });
    const fAt = await tokenFor(faculty);
    const res = await http()
      .patch(`/v1/exam-attempts/${String(attempt._id)}/grade`)
      .set(bearer(fAt))
      .send({
        grades: [
          {
            questionIndex: 1,
            score: 5,
            comment: 'Good argument',
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.attempt.totalScorePercent).toBe(90);
    expect(res.body.data.attempt.passed).toBe(true);

    const notifs = await Notification.find({
      userId: student._id,
      type: 'assessment.graded',
    });
    expect(notifs.length).toBe(1);
  });

  it('faculty from another course cannot grade (403)', async () => {
    const { student, course } = await setup();
    const { user: otherFaculty } = await makeFaculty();
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'E', kind: 'essay', points: 10 }],
    });
    const attempt = await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'x' }],
    });
    const at = await tokenFor(otherFaculty);
    const res = await http()
      .patch(`/v1/exam-attempts/${String(attempt._id)}/grade`)
      .set(bearer(at))
      .send({
        grades: [{ questionIndex: 0, score: 8, comment: '' }],
      });
    expect(res.status).toBe(403);
  });

  it('grading queue returns only ungraded submitted attempts for owned courses', async () => {
    const { faculty, student, course } = await setup();
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'E', kind: 'essay', points: 10 }],
    });
    // ungraded
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'x' }],
    });
    // already graded — should not appear
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(),
      essayAnswers: [{ questionIndex: 0, text: 'y' }],
      totalScorePercent: 88,
      passed: true,
    });
    const fAt = await tokenFor(faculty);
    const res = await http()
      .get('/v1/exam-attempts')
      .set(bearer(fAt));
    expect(res.status).toBe(200);
    expect(res.body.data.attempts.length).toBe(1);
  });
});
