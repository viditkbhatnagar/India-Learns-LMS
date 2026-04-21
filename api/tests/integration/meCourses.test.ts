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
  makeModule,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';

describe('GET /v1/me/courses/:courseId — course detail gate', () => {
  useMongo();
  useIntegrationSpies();

  async function scene(overrides: {
    state?: 'sandbox' | 'published';
    validTo?: Date;
    accessState?: 'active' | 'warn1' | 'warn2' | 'override' | 'suspended';
    skipEnrolment?: boolean;
  } = {}) {
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: overrides.state ?? 'published',
    });
    await makeModule({
      courseId: course._id,
      order: 0,
      content: [
        {
          kind: 'pdf',
          title: 'Leaked',
          videoUrl: null,
          pdfUrl: 'https://secret.test/paid.pdf',
          pdfStorageKey: 'stub:course-pdfs:xyz',
          allowDownload: true,
          textMarkdown: null,
          quizId: null,
        },
      ] as never,
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    if (!overrides.skipEnrolment) {
      await makeEnrollment({
        studentId: student._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
        validTo: overrides.validTo,
        accessState: overrides.accessState ?? 'active',
      });
    }
    const at = await tokenFor(student);
    return { program, course, at };
  }

  it('happy path returns course + modules', async () => {
    const { course, at } = await scene();
    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.modules.length).toBe(1);
    expect(res.body.data.modules[0].content[0].pdfUrl).toBe('https://secret.test/paid.pdf');
  });

  it('404 when course is sandbox', async () => {
    const { course, at } = await scene({ state: 'sandbox' });
    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(404);
  });

  it('403 NOT_ENROLLED when student has no active enrolment', async () => {
    const { course, at } = await scene({ skipEnrolment: true });
    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ENROLLED');
  });

  it('403 ENROLMENT_EXPIRED when validTo is past', async () => {
    const { course, at } = await scene({ validTo: new Date('2020-01-01T00:00:00Z') });
    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENROLMENT_EXPIRED');
  });

  it('403 SUSPENDED_ACCESS when accessState is suspended — no module URLs leak', async () => {
    const { course, at } = await scene({ accessState: 'suspended' });
    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUSPENDED_ACCESS');
    // Response must NOT contain any module or content payload.
    expect(res.body.data).toBeUndefined();
  });
});
