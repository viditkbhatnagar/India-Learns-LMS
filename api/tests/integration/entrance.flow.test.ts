import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeFaculty, makeStudent } from '../helpers/factories.js';
import {
  EntranceCandidate,
  EntranceExam,
  type EntranceExamDoc,
} from '../../src/models/index.js';
import { hashPassword } from '../../src/services/passwordService.js';

const PHONE = '9995551234';
const PASSWORD = 'exampass22';

async function setup(overrides: Partial<EntranceExamDoc> = {}) {
  const exam = await EntranceExam.create({
    title: 'Test Entrance Exam',
    instructions: 'Answer all.',
    durationMinutes: 45,
    totalMarks: 3,
    state: 'live',
    questions: [
      { section: 'A', text: 'Q1', kind: 'mcq', options: ['x', 'y'], correctIndex: 1, points: 1 },
      { section: 'A', text: 'Q2', kind: 'mcq', options: ['x', 'y'], correctIndex: 0, points: 1 },
      { section: 'B', text: 'Why fashion?', kind: 'text', options: [], correctIndex: null, points: 1 },
    ],
    ...overrides,
  });
  const candidate = await EntranceCandidate.create({
    examId: exam._id,
    name: 'Test Candidate',
    phone: PHONE,
    passwordHash: await hashPassword(PASSWORD),
    active: true,
  });
  return { exam, candidate };
}

async function login(phone = PHONE, password = PASSWORD) {
  return http().post('/v1/entrance/login').send({ phone, password });
}

describe('entrance exam — candidate flow', () => {
  useMongo();
  useIntegrationSpies();

  it('logs in with phone + password and returns an isolated token', async () => {
    await setup();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.candidate.phone).toBe(PHONE);
    // Candidate-facing exam DTO must NOT leak the answer key.
    expect(res.body.data.exam.questions[0]).not.toHaveProperty('correctIndex');
  });

  it('rejects a wrong password with 401', async () => {
    await setup();
    const res = await login(PHONE, 'wrongpassword');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refuses login when the exam window is closed', async () => {
    await setup({ state: 'closed' });
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENTRANCE_WINDOW_CLOSED');
  });

  it('runs start → autosave → resume → submit and auto-scores MCQs', async () => {
    await setup();
    const token = (await login()).body.data.token as string;
    const auth = { authorization: `Bearer ${token}` };

    const start = await http().post('/v1/entrance/me/attempt').set(auth).send({});
    expect(start.status).toBe(201);
    expect(start.body.data.attempt.status).toBe('in_progress');

    // Autosave a partial answer, then confirm it persists on reload.
    const save = await http()
      .patch('/v1/entrance/me/attempt')
      .set(auth)
      .send({ answers: [{ questionIndex: 0, selectedIndex: 1 }] });
    expect(save.status).toBe(200);

    const state = await http().get('/v1/entrance/me').set(auth);
    expect(state.status).toBe(200);
    const saved = state.body.data.attempt.answers.find(
      (a: { questionIndex: number }) => a.questionIndex === 0,
    );
    expect(saved.selectedIndex).toBe(1);

    // Submit with the rest of the answers (final merge).
    const submit = await http()
      .post('/v1/entrance/me/attempt/submit')
      .set(auth)
      .send({
        answers: [
          { questionIndex: 1, selectedIndex: 1 }, // wrong
          { questionIndex: 2, textAnswer: 'I love design.' },
        ],
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.attempt.status).toBe('submitted');
    // Candidate self view never exposes a score.
    expect(submit.body.data.attempt).not.toHaveProperty('totalScoreMarks');

    // Second submit is rejected.
    const again = await http().post('/v1/entrance/me/attempt/submit').set(auth).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ENTRANCE_ALREADY_SUBMITTED');
  });

  it('keeps entrance and normal-user auth realms separate', async () => {
    await setup();
    const token = (await login()).body.data.token as string;
    const auth = { authorization: `Bearer ${token}` };

    // Entrance token cannot reach a normal user route.
    const cross = await http().get('/v1/users/me').set(auth);
    expect(cross.status).toBe(401);

    // A normal user token cannot reach the candidate route.
    const { user: student } = await makeStudent();
    const userToken = await tokenFor(student);
    const cross2 = await http().get('/v1/entrance/me').set(bearer(userToken));
    expect(cross2.status).toBe(401);
  });
});

describe('entrance exam — admin/teacher side', () => {
  useMongo();
  useIntegrationSpies();

  it('lists candidates, shows the full attempt, and grades the written answer', async () => {
    const { exam, candidate } = await setup();
    const token = (await login()).body.data.token as string;
    const auth = { authorization: `Bearer ${token}` };
    await http().post('/v1/entrance/me/attempt').set(auth).send({});
    await http()
      .post('/v1/entrance/me/attempt/submit')
      .set(auth)
      .send({
        answers: [
          { questionIndex: 0, selectedIndex: 1 }, // correct
          { questionIndex: 1, selectedIndex: 1 }, // wrong
          { questionIndex: 2, textAnswer: 'Because I am creative.' },
        ],
      });

    const { user: faculty } = await makeFaculty();
    const staff = bearer(await tokenFor(faculty));

    const list = await http()
      .get(`/v1/entrance/admin/exams/${String(exam._id)}/candidates`)
      .set(staff);
    expect(list.status).toBe(200);
    const row = list.body.data.candidates[0];
    expect(row.status).toBe('submitted');
    expect(row.autoScoreMarks).toBe(1); // Q1 right, Q2 wrong
    expect(row.pendingManualGrade).toBe(true);

    const detail = await http()
      .get(`/v1/entrance/admin/candidates/${String(candidate._id)}`)
      .set(staff);
    expect(detail.status).toBe(200);
    const attempt = detail.body.data.attempt;
    expect(attempt.answers[2].textAnswer).toBe('Because I am creative.');
    expect(attempt.answers[0].isCorrect).toBe(true);

    const grade = await http()
      .patch(`/v1/entrance/admin/attempts/${attempt.id}/grade`)
      .set(staff)
      .send({ questionIndex: 2, marks: 1, comment: 'Good.' });
    expect(grade.status).toBe(200);
    expect(grade.body.data.attempt.status).toBe('graded');
    expect(grade.body.data.attempt.totalScoreMarks).toBe(2); // 1 auto + 1 manual
    expect(grade.body.data.attempt.manualComment).toBe('Good.');
  });

  it('blocks candidate tokens from the admin surface', async () => {
    await setup();
    const token = (await login()).body.data.token as string;
    const res = await http()
      .get('/v1/entrance/admin/exams')
      .set({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });
});
