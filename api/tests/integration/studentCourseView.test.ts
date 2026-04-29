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
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import {
  Assignment,
  AssignmentSubmission,
  ModuleModel,
  SessionModel,
} from '../../src/models/index.js';

/**
 * PR #16 Phase 4 — aggregated student-view endpoint. The student "your
 * course" page calls this once and gets back a fully nested tree with
 * status + progress rollups pre-computed server-side.
 *
 * Locks down:
 *   1. Shape contract (course / enrolment / progress / counts /
 *      needsAttention / modules → sessions → assignments).
 *   2. The draft-leak invariant: a `graded_draft` submission must never
 *      surface its score/feedback to the student. The status DTO bucket
 *      stays at `submitted` until the draft is published.
 *   3. dueSoon vs late vs upcoming bucketing keys off `dueAt`
 *      relative to "now".
 */

async function buildCourse() {
  const program = await makeProgram();
  const { user: faculty } = await makeFaculty();
  const course = await makeCourse({
    programId: program._id,
    state: 'published',
    facultyIds: [faculty._id],
  });
  const moduleA = await ModuleModel.create({
    courseId: course._id,
    title: 'Foundations',
    order: 0,
    sourceModuleId: 'modA',
    code: 'M1',
    aim: 'Establish the basics.',
  });
  const moduleB = await ModuleModel.create({
    courseId: course._id,
    title: 'Application',
    order: 1,
    sourceModuleId: 'modB',
    code: 'M2',
    aim: 'Apply to real workplace problems.',
  });
  const sA0 = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 0,
    title: 'Session A0',
    description: 'Intro',
    sourceLessonId: 'A0',
  });
  const sA1 = await SessionModel.create({
    moduleId: moduleA._id,
    courseId: course._id,
    number: 1,
    title: 'Session A1',
    description: 'Practice',
    sourceLessonId: 'A1',
  });
  const sB0 = await SessionModel.create({
    moduleId: moduleB._id,
    courseId: course._id,
    number: 0,
    title: 'Session B0',
    description: 'Cases',
    sourceLessonId: 'B0',
  });
  const batch = await makeBatch({ programId: program._id });
  const { user: student } = await makeStudent();
  await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
  });
  return {
    program, faculty, course, moduleA, moduleB, sA0, sA1, sB0, student, batch,
  };
}

describe('GET /v1/me/courses/:courseId/student-view', () => {
  useMongo();
  useIntegrationSpies();

  it('returns the full nested course tree with progress rollups', async () => {
    const { course, sA0, faculty, student } = await buildCourse();
    // One assignment due in 3 days (dueSoon), one due in 30 days (upcoming).
    await Assignment.create({
      courseId: course._id,
      sessionId: sA0._id,
      moduleId: sA0.moduleId,
      authorUserId: faculty._id,
      title: 'A0 quiz',
      instructions: 'do it',
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      state: 'open',
    });
    await Assignment.create({
      courseId: course._id,
      sessionId: sA0._id,
      moduleId: sA0.moduleId,
      authorUserId: faculty._id,
      title: 'A0 reflection',
      instructions: 'reflect',
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      maxScore: 50,
      state: 'open',
    });

    const at = await tokenFor(student);
    const res = await http()
      .get(`/v1/me/courses/${course._id.toString()}/student-view`)
      .set(bearer(at));
    expect(res.status).toBe(200);

    const body = res.body.data;
    expect(body.course.id).toBe(course._id.toString());
    expect(body.course.title).toBeTypeOf('string');
    expect(body.modules).toHaveLength(2);
    // Module A has 2 sessions, B has 1.
    expect(body.modules[0].sessions).toHaveLength(2);
    expect(body.modules[1].sessions).toHaveLength(1);
    // Session A0 has 2 assignments; A1 + B0 have 0.
    expect(body.modules[0].sessions[0].assignments).toHaveLength(2);
    expect(body.modules[0].sessions[1].assignments).toHaveLength(0);
    expect(body.modules[1].sessions[0].assignments).toHaveLength(0);
    // Counts: 1 dueSoon, 1 upcoming, 0 late.
    expect(body.counts.late).toBe(0);
    expect(body.counts.dueSoon).toBe(1);
    expect(body.counts.upcoming).toBe(1);
    // Needs-attention surfaces the dueSoon row.
    expect(body.needsAttention).toHaveLength(1);
    expect(body.needsAttention[0].status).toBe('dueSoon');
    // Progress rollup: 0 of 2 graded → 0%.
    expect(body.progress.totalAssignments).toBe(2);
    expect(body.progress.completedAssignments).toBe(0);
    expect(body.progress.percentComplete).toBe(0);
  });

  it('NEVER leaks score/feedback for a graded_draft submission (locks the draft-leak invariant)', async () => {
    const { course, sA0, faculty, student } = await buildCourse();
    const a = await Assignment.create({
      courseId: course._id,
      sessionId: sA0._id,
      moduleId: sA0.moduleId,
      authorUserId: faculty._id,
      title: 'Essay',
      instructions: 'write',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      state: 'open',
    });
    await AssignmentSubmission.create({
      assignmentId: a._id,
      courseId: course._id,
      studentId: student._id,
      bodyText: 'submission text',
      attachmentUrl: null,
      submittedAt: new Date(),
      // Faculty has saved a draft grade, NOT published it.
      status: 'graded_draft',
      score: 87,
      feedback: 'almost there',
      gradedBy: faculty._id,
      gradedAt: new Date(),
      gradeDraftedAt: new Date(),
      gradePublishedAt: null,
      maxScore: 100,
    });

    const at = await tokenFor(student);
    const res = await http()
      .get(`/v1/me/courses/${course._id.toString()}/student-view`)
      .set(bearer(at));
    expect(res.status).toBe(200);

    const sessionDto = res.body.data.modules[0].sessions[0];
    expect(sessionDto.assignments).toHaveLength(1);
    const dto = sessionDto.assignments[0];
    // The status bucket is `submitted` — NOT `graded` — until publish.
    expect(dto.status).toBe('submitted');
    // And the score/feedback fields must be null in the wire payload.
    expect(dto.score).toBeNull();
    expect(dto.feedback).toBeNull();
  });

  it('flips to status=graded with score/feedback once the submission is published', async () => {
    const { course, sA0, faculty, student } = await buildCourse();
    const a = await Assignment.create({
      courseId: course._id,
      sessionId: sA0._id,
      moduleId: sA0.moduleId,
      authorUserId: faculty._id,
      title: 'Essay',
      instructions: 'write',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      state: 'open',
    });
    await AssignmentSubmission.create({
      assignmentId: a._id,
      courseId: course._id,
      studentId: student._id,
      bodyText: 'submission text',
      attachmentUrl: null,
      submittedAt: new Date(),
      status: 'published',
      score: 87,
      feedback: 'great work',
      gradedBy: faculty._id,
      gradedAt: new Date(),
      gradeDraftedAt: new Date(),
      gradePublishedAt: new Date(),
      maxScore: 100,
    });

    const at = await tokenFor(student);
    const res = await http()
      .get(`/v1/me/courses/${course._id.toString()}/student-view`)
      .set(bearer(at));
    expect(res.status).toBe(200);

    const dto = res.body.data.modules[0].sessions[0].assignments[0];
    expect(dto.status).toBe('graded');
    expect(dto.score).toBe(87);
    expect(dto.feedback).toBe('great work');
    // Course-level rollup reflects the graded one.
    expect(res.body.data.progress.completedAssignments).toBe(1);
    expect(res.body.data.progress.percentComplete).toBe(100);
  });

  it('404 for invalid courseId; 403 NOT_ENROLLED for published-and-unenrolled', async () => {
    const { course, student } = await buildCourse();
    const at = await tokenFor(student);
    const bad = await http().get('/v1/me/courses/not-an-id/student-view').set(bearer(at));
    expect(bad.status).toBe(404);

    const program2 = await makeProgram();
    const otherCourse = await makeCourse({ programId: program2._id, state: 'published' });
    const noEnrol = await http()
      .get(`/v1/me/courses/${otherCourse._id.toString()}/student-view`)
      .set(bearer(at));
    expect(noEnrol.status).toBe(403);
    expect(noEnrol.body.error.code).toBe('NOT_ENROLLED');
    // Sanity: the existing course works for the same student.
    const ok = await http()
      .get(`/v1/me/courses/${course._id.toString()}/student-view`)
      .set(bearer(at));
    expect(ok.status).toBe(200);
  });
});
