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
  makeStudent,
} from '../helpers/factories.js';
import {
  Assignment,
  ModuleModel,
  SessionModel,
} from '../../src/models/index.js';

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
    // B-1 fix (PR #12): the response shape now also includes the Phase B-2
    // sessions list and the per-assignment submission state. The student
    // course shell relies on these to render the new session view.
    expect(Array.isArray(res.body.data.sessions)).toBe(true);
    expect(Array.isArray(res.body.data.assignments)).toBe(true);
    expect(res.body.data).toHaveProperty('enrolment');
  });

  it('404 NOT_FOUND for an invalid courseId (not an ObjectId)', async () => {
    const { at } = await scene();
    const res = await http().get('/v1/me/courses/not-an-objectid').set(bearer(at));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    // The frontend keys off this code to render an empty state instead of
    // the destructure crash from before PR #12. Lock the contract here.
    expect(res.body.error.message).toBeTruthy();
  });

  it('returns sessions ordered (module, number) and strips faculty-only `notes`', async () => {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const moduleA = await ModuleModel.create({
      courseId: course._id,
      title: 'Module A',
      order: 0,
      sourceModuleId: 'modA',
    });
    await SessionModel.create({
      moduleId: moduleA._id,
      courseId: course._id,
      number: 0,
      title: 'A0',
      sourceLessonId: 'A0',
      notes: 'do not leak this to students',
    });
    await SessionModel.create({
      moduleId: moduleA._id,
      courseId: course._id,
      number: 1,
      title: 'A1',
      sourceLessonId: 'A1',
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const at = await tokenFor(student);

    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.sessions).toHaveLength(2);
    expect(res.body.data.sessions[0].title).toBe('A0');
    expect(res.body.data.sessions[1].title).toBe('A1');
    // Faculty-only fields must not be exposed to students.
    for (const s of res.body.data.sessions) {
      expect(s).not.toHaveProperty('notes');
      expect(s).not.toHaveProperty('completedBy');
    }
  });

  it('embeds mySubmission per assignment for the calling student', async () => {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    await Assignment.create({
      courseId: course._id,
      authorUserId: faculty._id,
      title: 'Essay',
      instructions: 'Write 500 words on operations excellence.',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      state: 'open',
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const at = await tokenFor(student);

    const res = await http().get(`/v1/me/courses/${course._id.toString()}`).set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.assignments).toHaveLength(1);
    expect(res.body.data.assignments[0]).toHaveProperty('mySubmission', null);
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
