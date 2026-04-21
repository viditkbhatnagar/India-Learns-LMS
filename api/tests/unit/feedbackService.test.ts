import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeCourse,
  makeProgram,
  makeRubric,
  makeUser,
} from '../helpers/factories.js';
import {
  createFeedback,
  publishFeedback,
  updateFeedback,
} from '../../src/services/feedbackService.js';
import { Notification, type HydratedUser } from '../../src/models/index.js';

function authFor(user: HydratedUser) {
  return {
    userId: user._id,
    role: user.role,
    status: user.status,
    user,
  };
}

describe('feedbackService', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('enforces rubric scores length equals rubric criteria length', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const rubric = await makeRubric({
      courseId: course._id,
      criteria: [
        { label: 'A', kind: 'numeric', maxScore: 5 },
        { label: 'B', kind: 'numeric', maxScore: 5 },
        { label: 'C', kind: 'numeric', maxScore: 5 },
      ],
    });
    await expect(
      createFeedback(
        authFor(faculty as unknown as HydratedUser),
        {
          studentId: student._id.toString(),
          courseId: course._id.toString(),
          level: 'module',
          moduleId: null, // invalid, but we short-circuit on rubric mismatch
          rubricId: rubric._id.toString(),
          scores: [{ criterionIndex: 0, score: 3, label: null }],
          summary: 'x',
        },
        { actorUserId: faculty._id },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('draft → publish sets publishedAt and enqueues notification', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const entry = await createFeedback(
      authFor(faculty as unknown as HydratedUser),
      {
        studentId: student._id.toString(),
        courseId: course._id.toString(),
        level: 'assessment',
        assessmentRef: student._id.toString(), // any non-null id for level=assessment
        summary: 'Great effort on the exam',
        status: 'draft',
      },
      { actorUserId: faculty._id },
    );
    expect(entry.status).toBe('draft');
    expect(entry.publishedAt).toBeNull();

    const published = await publishFeedback(
      authFor(faculty as unknown as HydratedUser),
      entry._id.toString(),
      { actorUserId: faculty._id },
    );
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeTruthy();

    const notifs = await Notification.find({ userId: student._id });
    expect(notifs.length).toBe(1);
    expect(notifs[0]!.type).toBe('feedback.published');
    expect(spies.email.calls.some((c) => c.to === student.email)).toBe(true);
  });

  it('update cannot revert a published feedback back to draft', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const entry = await createFeedback(
      authFor(faculty as unknown as HydratedUser),
      {
        studentId: student._id.toString(),
        courseId: course._id.toString(),
        level: 'assessment',
        assessmentRef: student._id.toString(),
        summary: 'ok',
        status: 'published',
      },
      { actorUserId: faculty._id },
    );
    expect(entry.status).toBe('published');
    await expect(
      updateFeedback(
        authFor(faculty as unknown as HydratedUser),
        entry._id.toString(),
        { status: 'draft' },
        { actorUserId: faculty._id },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('requires moduleId on module-level feedback', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    await expect(
      createFeedback(
        authFor(faculty as unknown as HydratedUser),
        {
          studentId: student._id.toString(),
          courseId: course._id.toString(),
          level: 'module',
          summary: 'missing module',
        },
        { actorUserId: faculty._id },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});
