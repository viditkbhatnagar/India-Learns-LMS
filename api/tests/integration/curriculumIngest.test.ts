import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeBatch, makeEnrollment, makeFaculty, makeProgram, makeStudent, makeUser } from '../helpers/factories.js';
import { Course, ModuleModel, SessionModel } from '../../src/models/index.js';

describe('POST /v1/curriculum-import/lessons (ingest a lesson-plan document)', () => {
  useMongo();
  useIntegrationSpies();

  const body = (programId: string, extra: Record<string, unknown> = {}) => ({
    programId,
    name: 'Diploma in Digital Fashion Entrepreneurship',
    modules: [
      { title: 'M1 Foundations', lessons: [{ title: 'Lesson A' }, { title: 'Lesson B', plannedMinutes: 90 }] },
      { title: 'M2 Practice', lessons: [{ title: 'Lesson C' }] },
    ],
    ...extra,
  });

  it('creates a new sandbox course with the parsed modules + lessons', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa-${Date.now()}@x.com` });
    const at = await tokenFor(sa);

    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(true);
    expect(res.body.data.modules).toBe(2);
    expect(res.body.data.lessons).toBe(3);

    const courseId = res.body.data.courseId;
    expect(await ModuleModel.countDocuments({ courseId, deletedAt: null })).toBe(2);
    const sessions = await SessionModel.find({ courseId, deletedAt: null });
    expect(sessions).toHaveLength(3);
    // manual lessons must survive a later generator re-import
    expect(sessions.every((s) => s.sourceLessonId === null && s.synthesized === false)).toBe(true);
  });

  it('replaces an existing course wholesale when courseId is given', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa2-${Date.now()}@x.com` });
    const at = await tokenFor(sa);

    const first = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    const courseId = first.body.data.courseId as string;

    const replaced = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(at))
      .send(
        body(String(program._id), {
          courseId,
          modules: [{ title: 'Only Module', lessons: [{ title: 'Solo lesson' }] }],
        }),
      );
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.created).toBe(false);
    expect(replaced.body.data.courseId).toBe(courseId); // same course
    // live content is the new set; the old rows are tombstoned, not destroyed
    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(1);
    expect(await ModuleModel.countDocuments({ courseId, deletedAt: null })).toBe(1);
  });

  it('rejects students', async () => {
    const program = await makeProgram();
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(403);
  });

  it('rejects admins — course content is the teaching faculty\'s to change (oversight)', async () => {
    const program = await makeProgram();
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(403);
  });

  it('faculty can create a course and is auto-assigned to teach it', async () => {
    const program = await makeProgram();
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const res = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    expect(res.status).toBe(201);
    const course = await Course.findById(res.body.data.courseId);
    expect(course!.facultyIds.map(String)).toContain(String(fac._id));
  });

  it('faculty can replace a course they teach, but NOT one they do not', async () => {
    const program = await makeProgram();
    const { user: owner } = await makeFaculty();
    const { user: other } = await makeFaculty();
    const ownerAt = await tokenFor(owner);
    const otherAt = await tokenFor(other);

    const created = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(ownerAt))
      .send(body(String(program._id)));
    const courseId = created.body.data.courseId as string;

    const mine = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(ownerAt))
      .send(body(String(program._id), { courseId, modules: [{ title: 'M', lessons: [{ title: 'L' }] }] }));
    expect(mine.status).toBe(201);
    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(1);

    const theirs = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(otherAt))
      .send(body(String(program._id), { courseId, modules: [{ title: 'X', lessons: [{ title: 'Hijack' }] }] }));
    expect(theirs.status).toBe(403);
    // untouched by the rejected attempt
    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(1);
  });

  it('REFUSES to replace a course that has enrolled students (protects their work)', async () => {
    const program = await makeProgram();
    const batch = await makeBatch({ programId: program._id });
    const { user: sa } = { user: await makeUser({ role: 'superadmin', email: `sa3-${Date.now()}@x.com` }) };
    const at = await tokenFor(sa);
    const created = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    const courseId = created.body.data.courseId as string;

    const { user: student } = await makeStudent();
    await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId,
      programId: program._id,
    });

    const res = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(at))
      .send(body(String(program._id), { courseId, modules: [{ title: 'M', lessons: [{ title: 'L' }] }] }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_IN_USE');
    // nothing was destroyed
    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(3);
  });

  it('replace SOFT-deletes the old content so a mistake is recoverable', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa4-${Date.now()}@x.com` });
    const at = await tokenFor(sa);
    const created = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    const courseId = created.body.data.courseId as string;

    await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(at))
      .send(body(String(program._id), { courseId, modules: [{ title: 'New', lessons: [{ title: 'Only' }] }] }));

    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(1);
    // the 3 originals are tombstoned, not gone
    expect(await SessionModel.countDocuments({ courseId, deletedAt: { $ne: null } })).toBe(3);
  });

  it('rejects a payload with a blank lesson title BEFORE destroying anything', async () => {
    const program = await makeProgram();
    const sa = await makeUser({ role: 'superadmin', email: `sa5-${Date.now()}@x.com` });
    const at = await tokenFor(sa);
    const created = await http().post('/v1/curriculum-import/lessons').set(bearer(at)).send(body(String(program._id)));
    const courseId = created.body.data.courseId as string;

    const bad = await http()
      .post('/v1/curriculum-import/lessons')
      .set(bearer(at))
      .send({
        programId: String(program._id),
        name: 'x',
        courseId,
        modules: [{ title: 'M', lessons: [{ title: '   ' }] }],
      });
    expect(bad.status).toBe(422);
    // original content untouched
    expect(await SessionModel.countDocuments({ courseId, deletedAt: null })).toBe(3);
  });

  it('faculty cannot reach the generator-import endpoints (still superadmin-only)', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    expect((await http().get('/v1/curriculum-import/workflows').set(bearer(at))).status).toBe(403);
    expect((await http().get('/v1/curriculum-import/health').set(bearer(at))).status).toBe(403);
    expect(
      (await http().post('/v1/curriculum-import').set(bearer(at)).send({ workflowId: 'x', programId: 'y' })).status,
    ).toBe(403);
  });
});
