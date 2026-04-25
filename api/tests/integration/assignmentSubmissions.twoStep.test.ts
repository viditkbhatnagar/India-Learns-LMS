import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
  makeUser,
} from '../helpers/factories.js';
import { Assignment, AssignmentSubmission } from '../../src/models/index.js';

// Phase B-1: two-step grading.
//
// Covered:
//   - student submit creates a submission with status='submitted'
//   - faculty save-draft transitions to status='graded_draft'
//   - student GET on the assignment NEVER sees draft score/feedback
//   - faculty publish flips to 'published' + student now sees the score
//   - re-saving a draft on a published submission flips back to graded_draft
//   - bulk publish handles a mix of drafts and already-published rows
//   - faculty cannot grade in a course they don't own (403)
//   - superadmin grades any course (oversight)
//   - student re-submission resets state to 'submitted' and clears prior grade

async function buildCourseWithFaculty() {
  const program = await makeProgram();
  const { user: faculty } = await makeFaculty();
  const course = await makeCourse({
    programId: program._id,
    facultyIds: [faculty._id],
  });
  const batch = await makeBatch({ programId: program._id });
  return { program, faculty, course, batch };
}

async function makeAssignmentFor(courseId: typeof Object & object, facultyId: object): Promise<{ id: string; maxScore: number }> {
  const a = await Assignment.create({
    courseId,
    moduleId: null,
    sessionId: null,
    authorUserId: facultyId,
    title: 'Essay 1',
    instructions: 'Write a workplace essay.',
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxScore: 100,
    state: 'open',
    rubric: [
      {
        criterionName: 'Clarity',
        linkedMLOs: [],
        weight: 50,
        fail: '',
        pass: '',
        merit: '',
        distinction: '',
      },
      {
        criterionName: 'Depth',
        linkedMLOs: [],
        weight: 50,
        fail: '',
        pass: '',
        merit: '',
        distinction: '',
      },
    ],
  });
  return { id: a._id.toString(), maxScore: a.maxScore };
}

async function studentSubmits(
  studentToken: string,
  assignmentId: string,
): Promise<string> {
  const res = await http()
    .post(`/v1/assignments/${assignmentId}/submissions`)
    .set(bearer(studentToken))
    .send({ bodyText: 'My answer' });
  expect(res.status).toBe(201);
  return res.body.data.submission.id as string;
}

describe('assignment submissions — two-step grading (Phase B-1)', () => {
  useMongo();
  useIntegrationSpies();

  it('lifecycle: student submit → faculty draft → publish → student sees', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const { id: assignmentId, maxScore } = await makeAssignmentFor(course._id, faculty._id);
    const studentToken = await tokenFor(student);
    const facultyToken = await tokenFor(faculty);

    const subId = await studentSubmits(studentToken, assignmentId);

    // Submission row exists with status=submitted.
    let row = await AssignmentSubmission.findById(subId);
    expect(row).not.toBeNull();
    expect(row!.status).toBe('submitted');
    expect(row!.score).toBeNull();

    // Student fetches assignment → score must be null and status visible only as 'submitted'.
    const stView1 = await http()
      .get(`/v1/assignments/${assignmentId}`)
      .set(bearer(studentToken));
    expect(stView1.status).toBe(200);
    expect(stView1.body.data.mySubmission.score).toBeNull();
    expect(stView1.body.data.mySubmission.status).toBe('submitted');

    // Faculty saves a draft.
    const draftRes = await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(facultyToken))
      .send({
        score: 82,
        feedback: 'Good but tighten the conclusion.',
        rubricScores: [
          { criterionIndex: 0, score: 42, comment: 'Clear thesis' },
          { criterionIndex: 1, score: 40, comment: 'More evidence needed' },
        ],
      });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.submission.status).toBe('graded_draft');
    expect(draftRes.body.data.submission.score).toBe(82);

    row = await AssignmentSubmission.findById(subId);
    expect(row!.status).toBe('graded_draft');
    expect(row!.publishedAt).toBeNull();

    // Student MUST NOT see the draft.
    const stView2 = await http()
      .get(`/v1/assignments/${assignmentId}`)
      .set(bearer(studentToken));
    expect(stView2.status).toBe(200);
    expect(stView2.body.data.mySubmission.status).toBe('submitted');
    expect(stView2.body.data.mySubmission.score).toBeNull();
    expect(stView2.body.data.mySubmission.feedback).toBeNull();
    expect(stView2.body.data.mySubmission.rubricScores).toEqual([]);

    // Faculty publishes.
    const pubRes = await http()
      .post(`/v1/assignment-submissions/${subId}/publish`)
      .set(bearer(facultyToken))
      .send({});
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.submission.status).toBe('published');

    // Student NOW sees the grade.
    const stView3 = await http()
      .get(`/v1/assignments/${assignmentId}`)
      .set(bearer(studentToken));
    expect(stView3.status).toBe(200);
    expect(stView3.body.data.mySubmission.status).toBe('published');
    expect(stView3.body.data.mySubmission.score).toBe(82);
    expect(stView3.body.data.mySubmission.feedback).toContain('tighten the conclusion');
    expect(stView3.body.data.mySubmission.rubricScores).toHaveLength(2);

    // Score sanity vs maxScore.
    expect(stView3.body.data.mySubmission.score).toBeLessThanOrEqual(maxScore);
  });

  it('publish without a prior draft is rejected with INVALID_TRANSITION', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const studentToken = await tokenFor(student);
    const facultyToken = await tokenFor(faculty);
    const subId = await studentSubmits(studentToken, assignmentId);

    const res = await http()
      .post(`/v1/assignment-submissions/${subId}/publish`)
      .set(bearer(facultyToken))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('saving a draft on a published submission flips it back to graded_draft', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const studentToken = await tokenFor(student);
    const facultyToken = await tokenFor(faculty);
    const subId = await studentSubmits(studentToken, assignmentId);

    await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(facultyToken))
      .send({ score: 70 });
    await http()
      .post(`/v1/assignment-submissions/${subId}/publish`)
      .set(bearer(facultyToken))
      .send({});

    // Re-grade as a draft.
    const res = await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(facultyToken))
      .send({ score: 90, feedback: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.submission.status).toBe('graded_draft');
    expect(res.body.data.submission.score).toBe(90);

    // Student does NOT see the new score until faculty re-publishes.
    const stView = await http()
      .get(`/v1/assignments/${assignmentId}`)
      .set(bearer(studentToken));
    // Previous publish would have leaked through if we returned the doc as-is,
    // but our DTO strip blanks the grade for any non-published status.
    expect(stView.body.data.mySubmission.status).toBe('submitted');
    expect(stView.body.data.mySubmission.score).toBeNull();
  });

  it('faculty in a different course cannot save drafts (403)', async () => {
    const { course: courseA, faculty: facultyA, batch, program } = await buildCourseWithFaculty();
    const { user: facultyB } = await makeFaculty(); // not on courseA
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: courseA._id,
      programId: program._id,
    });
    const { id: assignmentId } = await makeAssignmentFor(courseA._id, facultyA._id);
    const studentToken = await tokenFor(student);
    const subId = await studentSubmits(studentToken, assignmentId);

    const tokenB = await tokenFor(facultyB);
    const res = await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(tokenB))
      .send({ score: 80 });
    expect(res.status).toBe(403);
  });

  it('superadmin can grade any course (oversight)', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const sa = await makeUser({ role: 'superadmin', password: 'Super#12345' });
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const studentToken = await tokenFor(student);
    const subId = await studentSubmits(studentToken, assignmentId);
    const saToken = await tokenFor(sa);

    const draft = await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(saToken))
      .send({ score: 95 });
    expect(draft.status).toBe(200);
    const pub = await http()
      .post(`/v1/assignment-submissions/${subId}/publish`)
      .set(bearer(saToken))
      .send({});
    expect(pub.status).toBe(200);
    expect(pub.body.data.submission.publishedByUserId).toBe(sa._id.toString());
  });

  it('student re-submission resets to submitted and clears prior grade', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const studentToken = await tokenFor(student);
    const facultyToken = await tokenFor(faculty);
    const subId = await studentSubmits(studentToken, assignmentId);

    await http()
      .post(`/v1/assignment-submissions/${subId}/draft`)
      .set(bearer(facultyToken))
      .send({ score: 55 });
    await http()
      .post(`/v1/assignment-submissions/${subId}/publish`)
      .set(bearer(facultyToken))
      .send({});

    // Student re-submits.
    await http()
      .post(`/v1/assignments/${assignmentId}/submissions`)
      .set(bearer(studentToken))
      .send({ bodyText: 'Improved answer' });

    const row = await AssignmentSubmission.findById(subId);
    expect(row!.status).toBe('submitted');
    expect(row!.score).toBeNull();
    expect(row!.feedback).toBeNull();
    expect(row!.publishedAt).toBeNull();
    expect(row!.gradedAt).toBeNull();
  });

  it('bulk publish: 2 drafts + 1 already-published → published=2, skipped=1', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: studentA } = await makeStudent();
    const { user: studentB } = await makeStudent();
    const { user: studentC } = await makeStudent();
    for (const s of [studentA, studentB, studentC]) {
      await makeEnrollment({
        studentId: s._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
    }
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const facultyToken = await tokenFor(faculty);

    const ids: string[] = [];
    for (const s of [studentA, studentB, studentC]) {
      const t = await tokenFor(s);
      ids.push(await studentSubmits(t, assignmentId));
    }
    // Draft on all three.
    for (const id of ids) {
      await http()
        .post(`/v1/assignment-submissions/${id}/draft`)
        .set(bearer(facultyToken))
        .send({ score: 70 });
    }
    // Publish the first one ahead of the bulk call.
    await http()
      .post(`/v1/assignment-submissions/${ids[0]}/publish`)
      .set(bearer(facultyToken))
      .send({});

    const res = await http()
      .post('/v1/assignment-submissions/bulk-publish')
      .set(bearer(facultyToken))
      .send({ submissionIds: ids });
    expect(res.status).toBe(200);
    expect(res.body.data.published).toHaveLength(2);
    expect(res.body.data.skipped.length + res.body.data.published.length).toBe(3);
    // The already-published id ends up in `published` because publishGrade is
    // idempotent; the assertion that matters is everyone is published end of
    // the call.
    const all = await AssignmentSubmission.find({ assignmentId });
    expect(all.every((s) => s.status === 'published')).toBe(true);
  });

  it('GET /v1/courses/:courseId/gradebook returns rows × columns + backlog', async () => {
    const { faculty, course, batch, program } = await buildCourseWithFaculty();
    const { user: studentA } = await makeStudent();
    const { user: studentB } = await makeStudent();
    for (const s of [studentA, studentB]) {
      await makeEnrollment({
        studentId: s._id,
        batchId: batch._id,
        courseId: course._id,
        programId: program._id,
      });
    }
    const { id: assignmentId } = await makeAssignmentFor(course._id, faculty._id);
    const facultyToken = await tokenFor(faculty);
    const tokenA = await tokenFor(studentA);
    await studentSubmits(tokenA, assignmentId);
    // studentB never submits.

    const res = await http()
      .get(`/v1/courses/${course._id.toString()}/gradebook`)
      .set(bearer(facultyToken));
    expect(res.status).toBe(200);
    expect(res.body.data.students).toHaveLength(2);
    expect(res.body.data.assignments).toHaveLength(1);
    expect(res.body.data.cells).toHaveLength(2);
    expect(res.body.data.backlog).toBe(1);
    expect(res.body.data.publishedCount).toBe(0);
  });

  it('students cannot access /gradebook (403)', async () => {
    const { course, batch, program } = await buildCourseWithFaculty();
    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    const studentToken = await tokenFor(student);
    const res = await http()
      .get(`/v1/courses/${course._id.toString()}/gradebook`)
      .set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('admin sees gradebook for any course (oversight)', async () => {
    const { course } = await buildCourseWithFaculty();
    const { user: admin } = await makeAdmin();
    const adminToken = await tokenFor(admin);
    const res = await http()
      .get(`/v1/courses/${course._id.toString()}/gradebook`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
  });
});
