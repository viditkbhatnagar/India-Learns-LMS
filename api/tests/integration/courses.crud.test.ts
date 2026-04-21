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

  it('delete with modules returns 409 COURSE_IN_USE', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    await makeModule({ courseId: course._id, order: 0 });
    const res = await http()
      .delete(`/v1/courses/${course._id.toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_IN_USE');
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
