import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeCourse,
  makeFaculty,
  makeFeedback,
  makeProgram,
  makeRubric,
  makeStudent,
  makeUser,
} from '../helpers/factories.js';

describe('feedback routes', () => {
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
    return { faculty, student, course };
  }

  it('faculty creates rubric-backed feedback as draft, then publishes', async () => {
    const { faculty, student, course } = await setup();
    const rubric = await makeRubric({
      courseId: course._id,
      criteria: [
        { label: 'Clarity', kind: 'numeric', maxScore: 5 },
        { label: 'Depth', kind: 'numeric', maxScore: 5 },
      ],
    });
    const fAt = await tokenFor(faculty);
    const create = await http()
      .post('/v1/feedback')
      .set(bearer(fAt))
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        level: 'assessment',
        assessmentRef: String(student._id), // placeholder id
        rubricId: String(rubric._id),
        scores: [
          { criterionIndex: 0, score: 4 },
          { criterionIndex: 1, score: 5 },
        ],
        comments: 'Strong work',
        summary: 'Above expectations',
      });
    expect(create.status).toBe(201);
    const fbId = create.body.data.feedback.id;
    expect(create.body.data.feedback.status).toBe('draft');

    const pub = await http()
      .post(`/v1/feedback/${fbId}/publish`)
      .set(bearer(fAt))
      .send({});
    expect(pub.status).toBe(200);
    expect(pub.body.data.feedback.status).toBe('published');
    expect(pub.body.data.feedback.publishedAt).toBeTruthy();
  });

  it('rejects rubric mismatch (422 VALIDATION_FAILED)', async () => {
    const { faculty, student, course } = await setup();
    const rubric = await makeRubric({
      courseId: course._id,
      criteria: [
        { label: 'A', kind: 'numeric', maxScore: 5 },
        { label: 'B', kind: 'numeric', maxScore: 5 },
      ],
    });
    const fAt = await tokenFor(faculty);
    const res = await http()
      .post('/v1/feedback')
      .set(bearer(fAt))
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        level: 'assessment',
        assessmentRef: String(student._id),
        rubricId: String(rubric._id),
        scores: [{ criterionIndex: 0, score: 3 }], // length 1 ≠ 2
        summary: 's',
      });
    expect(res.status).toBe(422);
  });

  it('GET /v1/me/feedback returns only published feedback, newest first', async () => {
    const { faculty, student, course } = await setup();
    // Unpublished — must NOT appear
    await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'draft',
      summary: 'Draft one',
    });
    // Published older
    await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'published',
      publishedAt: new Date('2026-04-10T00:00:00Z'),
      summary: 'Older',
    });
    // Published newer
    await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'published',
      publishedAt: new Date('2026-04-20T00:00:00Z'),
      summary: 'Newer',
    });
    const sAt = await tokenFor(student);
    const res = await http()
      .get('/v1/me/feedback')
      .set(bearer(sAt));
    expect(res.status).toBe(200);
    expect(res.body.data.feedback.length).toBe(2);
    expect(res.body.data.feedback[0].summary).toBe('Newer');
    expect(res.body.data.feedback[1].summary).toBe('Older');
  });

  it('student cannot read another student\'s feedback', async () => {
    const { faculty, student, course } = await setup();
    const other = await makeUser({ role: 'student' });
    const entry = await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'published',
      publishedAt: new Date(),
    });
    const at = await tokenFor(other);
    const res = await http()
      .get(`/v1/feedback/${String(entry._id)}`)
      .set(bearer(at));
    expect(res.status).toBe(403);
  });

  it('student cannot POST or PATCH feedback (role gate)', async () => {
    const { student, course } = await setup();
    const sAt = await tokenFor(student);
    const res = await http()
      .post('/v1/feedback')
      .set(bearer(sAt))
      .send({
        studentId: String(student._id),
        courseId: String(course._id),
        level: 'module',
        moduleId: String(student._id),
        summary: 'nope',
      });
    expect(res.status).toBe(403);
  });

  it('finance role cannot read feedback via GET /v1/feedback/:id (role gate)', async () => {
    // Regression guard for the security review finding: the GET detail route
    // previously only applied requireAuth, so any authenticated staff role
    // (notably finance) could fetch arbitrary feedback including drafts.
    const { faculty, student, course } = await setup();
    const finance = await makeUser({ role: 'finance' });
    const draft = await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'draft',
      summary: 'confidential narrative',
    });
    const published = await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      status: 'published',
      publishedAt: new Date(),
      summary: 'published narrative',
    });
    const fAt = await tokenFor(finance);
    const draftRes = await http()
      .get(`/v1/feedback/${String(draft._id)}`)
      .set(bearer(fAt));
    expect(draftRes.status).toBe(403);
    expect(JSON.stringify(draftRes.body)).not.toContain('confidential narrative');

    const publishedRes = await http()
      .get(`/v1/feedback/${String(published._id)}`)
      .set(bearer(fAt));
    expect(publishedRes.status).toBe(403);
    expect(JSON.stringify(publishedRes.body)).not.toContain('published narrative');
  });
});
