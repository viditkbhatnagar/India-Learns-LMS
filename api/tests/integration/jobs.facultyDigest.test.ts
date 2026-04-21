import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import {
  makeCourse,
  makeExam,
  makeExamAttempt,
  makeFaculty,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import { signJobRequest } from '../../src/middleware/requireJobAuth.js';

const EIGHT_DAYS_MS = 8 * 86_400_000;

describe('POST /v1/jobs/digest-faculty-weekly', () => {
  useMongo();
  useIntegrationSpies();

  it('rejects unsigned requests (401)', async () => {
    const res = await http()
      .post('/v1/jobs/digest-faculty-weekly')
      .send({});
    expect(res.status).toBe(401);
  });

  it('signed request runs the digest and returns result', async () => {
    const { user: faculty } = await makeFaculty();
    const { user: student } = await makeStudent();
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'Essay', kind: 'essay', points: 10 }],
    });
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(Date.now() - EIGHT_DAYS_MS),
      essayAnswers: [{ questionIndex: 0, text: 'ans' }],
    });

    const body = { trigger: 'manual' };
    const sig = signJobRequest(body);
    const res = await http()
      .post('/v1/jobs/digest-faculty-weekly')
      .set({
        'x-job-signature': sig.signature,
        'x-job-timestamp': sig.timestamp,
      })
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.facultyCount).toBe(1);
    expect(res.body.data.emailsSent).toBe(1);
  });
});
