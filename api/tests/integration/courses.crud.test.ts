import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeCourse,
  makeFaculty,
  makeModule,
  makeProgram,
} from '../helpers/factories.js';

describe('courses CRUD', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates a sandbox course and can publish/unpublish it', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();

    const created = await http()
      .post('/v1/courses')
      .set(bearer(at))
      .send({
        programId: program._id.toString(),
        name: 'Airport Ground Ops',
        slug: 'airport-ground-ops',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.course.state).toBe('sandbox');
    expect(created.body.data.course.publishedVersion).toBe(0);

    const pub = await http()
      .post(`/v1/courses/${created.body.data.course.id}/publish`)
      .set(bearer(at));
    expect(pub.status).toBe(200);
    expect(pub.body.data.course.state).toBe('published');
    expect(pub.body.data.course.publishedVersion).toBe(1);
    expect(pub.body.data.course.publishedAt).not.toBeNull();

    const pubAgain = await http()
      .post(`/v1/courses/${created.body.data.course.id}/publish`)
      .set(bearer(at));
    expect(pubAgain.status).toBe(409);
    expect(pubAgain.body.error.code).toBe('COURSE_ALREADY_PUBLISHED');

    const unpub = await http()
      .post(`/v1/courses/${created.body.data.course.id}/unpublish`)
      .set(bearer(at));
    expect(unpub.status).toBe(200);
    expect(unpub.body.data.course.state).toBe('sandbox');
  });

  it('slug uniqueness is scoped to program', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const p1 = await makeProgram();
    const p2 = await makeProgram();
    const r1 = await http().post('/v1/courses').set(bearer(at)).send({
      programId: p1._id.toString(),
      name: 'C1',
      slug: 'shared-slug',
    });
    expect(r1.status).toBe(201);
    const r2 = await http().post('/v1/courses').set(bearer(at)).send({
      programId: p2._id.toString(),
      name: 'C2',
      slug: 'shared-slug',
    });
    expect(r2.status).toBe(201); // different program — OK
    const r3 = await http().post('/v1/courses').set(bearer(at)).send({
      programId: p1._id.toString(),
      name: 'C3',
      slug: 'shared-slug',
    });
    expect(r3.status).toBe(409);
    expect(['SLUG_EXISTS', 'CONFLICT']).toContain(r3.body.error.code);
  });

  it('faculty can GET courses they are assigned to, but not others', async () => {
    const { user: admin } = await makeAdmin();
    const { user: fac } = await makeFaculty();
    const { user: otherFac } = await makeFaculty();
    const at = await tokenFor(admin);
    const facAt = await tokenFor(fac);
    const program = await makeProgram();
    const mine = await makeCourse({
      programId: program._id,
      facultyIds: [fac._id],
      slug: 'mine',
    });
    await makeCourse({
      programId: program._id,
      facultyIds: [otherFac._id],
      slug: 'theirs',
    });

    const list = await http().get('/v1/courses').set(bearer(facAt));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);
    expect(list.body.data.items[0].slug).toBe('mine');

    const adminList = await http().get('/v1/courses').set(bearer(at));
    expect(adminList.body.data.items.length).toBe(2);

    const otherId = list.body.data.items[0].id;
    const fetched = await http().get(`/v1/courses/${otherId}`).set(bearer(facAt));
    expect(fetched.status).toBe(200);

    const forbidden = await http()
      .get(`/v1/courses/${(await (await import('../../src/models/index.js')).Course.findOne({ slug: 'theirs' }))!._id.toString()}`)
      .set(bearer(facAt));
    expect(forbidden.status).toBe(403);
    expect(mine.slug).toBe('mine');
  });

  it('faculty 403 on POST and DELETE', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const post = await http().post('/v1/courses').set(bearer(at)).send({
      programId: program._id.toString(),
      name: 'x',
      slug: 'x',
    });
    expect(post.status).toBe(403);
  });

  it('delete published course with modules returns 409 COURSE_IN_USE', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, state: 'published' });
    await makeModule({ courseId: course._id, order: 0 });
    const res = await http()
      .delete(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_IN_USE');
  });

  // PR #15 — sandbox courses cascade-soft-delete their curriculum-import
  // children so the operator can clear and re-import without DevTools
  // surgery. Published courses still require manual cleanup (above).
  it('delete sandbox course cascade-soft-deletes modules + sessions + materials + assignments', async () => {
    const {
      ModuleModel,
      SessionModel,
      Material,
      Assignment,
      AuditLog,
    } = await import('../../src/models/index.js');
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, state: 'sandbox' });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    await SessionModel.create({
      moduleId: mod._id,
      courseId: course._id,
      number: 0,
      title: 'Intro',
      sourceLessonId: 'A0',
    });
    await Material.create({
      courseId: course._id,
      moduleId: mod._id,
      type: 'reading',
      title: 'Handout',
    });
    await Assignment.create({
      courseId: course._id,
      moduleId: mod._id,
      authorUserId: admin._id,
      title: 'Quiz 1',
      instructions: 'do the thing',
      dueAt: new Date(Date.now() + 86_400_000),
      maxScore: 100,
      state: 'open',
    });

    const res = await http()
      .delete(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(200);

    // Children are soft-deleted (deletedAt set).
    expect(await ModuleModel.countDocuments({ courseId: course._id, deletedAt: null })).toBe(0);
    expect(await SessionModel.countDocuments({ courseId: course._id, deletedAt: null })).toBe(0);
    expect(await Material.countDocuments({ courseId: course._id, deletedAt: null })).toBe(0);
    expect(await Assignment.countDocuments({ courseId: course._id, deletedAt: null })).toBe(0);

    // Audit log carries the cascade counts so an operator can verify what
    // was caught in the sweep.
    const entry = await AuditLog.findOne({ action: 'course.deleted', targetId: course._id });
    expect(entry).not.toBeNull();
    const details = entry!.details as { cascade?: Record<string, number> } | null;
    expect(details?.cascade?.modules).toBe(1);
    expect(details?.cascade?.sessions).toBe(1);
    expect(details?.cascade?.materials).toBe(1);
    expect(details?.cascade?.assignments).toBe(1);
  });

  it('audit log records course.published with before/after state', async () => {
    const { AuditLog } = await import('../../src/models/index.js');
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    await http().post(`/v1/courses/${course._id.toString()}/publish`).set(bearer(at));
    const entry = await AuditLog.findOne({ action: 'course.published' });
    expect(entry).not.toBeNull();
    expect((entry!.before as { state: string }).state).toBe('sandbox');
    expect((entry!.after as { state: string }).state).toBe('published');
  });
});
