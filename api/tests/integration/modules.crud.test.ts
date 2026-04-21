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

describe('modules CRUD', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates a module and updates structural fields', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });

    const created = await http()
      .post(`/v1/courses/${course._id.toString()}/modules`)
      .set(bearer(at))
      .send({
        title: 'Welcome',
        order: 0,
        content: [
          { kind: 'text', title: 'Intro', textMarkdown: '# Welcome' },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.module.content[0].kind).toBe('text');

    const patched = await http()
      .patch(`/v1/modules/${created.body.data.module.id}`)
      .set(bearer(at))
      .send({ title: 'Welcome, Updated', order: 0 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.module.title).toBe('Welcome, Updated');
  });

  it('module order is unique within a course', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    await http()
      .post(`/v1/courses/${course._id.toString()}/modules`)
      .set(bearer(at))
      .send({
        title: 'M0',
        order: 0,
        content: [{ kind: 'text', title: 't', textMarkdown: '# t' }],
      });
    const clash = await http()
      .post(`/v1/courses/${course._id.toString()}/modules`)
      .set(bearer(at))
      .send({
        title: 'Also M0',
        order: 0,
        content: [{ kind: 'text', title: 't', textMarkdown: '# t' }],
      });
    expect(clash.status).toBe(409);
  });

  it('faculty assigned to the course can PATCH content but NOT title/order', async () => {
    const { user: admin } = await makeAdmin();
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(admin);
    const facAt = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [fac._id],
    });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const contentPatch = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(facAt))
      .send({
        content: [
          { kind: 'text', title: 'Intro', textMarkdown: '# Hello' },
        ],
      });
    expect(contentPatch.status).toBe(200);
    expect(contentPatch.body.data.module.content[0].title).toBe('Intro');

    const titlePatch = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(facAt))
      .send({ title: 'Renamed' });
    expect(titlePatch.status).toBe(403);
    expect(titlePatch.body.error.code).toBe('FORBIDDEN');

    const orderPatch = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(facAt))
      .send({ order: 5 });
    expect(orderPatch.status).toBe(403);

    // Admin still wins.
    const adminPatch = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ title: 'Admin rename' });
    expect(adminPatch.status).toBe(200);
  });

  it('faculty NOT assigned to the course is 403 on PATCH content', async () => {
    const { user: fac } = await makeFaculty();
    const facAt = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [] });
    const mod = await makeModule({ courseId: course._id });
    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(facAt))
      .send({
        content: [{ kind: 'text', title: 't', textMarkdown: '# t' }],
      });
    expect(res.status).toBe(403);
  });

  it('faculty 403 on DELETE module', async () => {
    const { user: fac } = await makeFaculty();
    const facAt = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      facultyIds: [fac._id],
    });
    const mod = await makeModule({ courseId: course._id });
    const res = await http()
      .delete(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(facAt));
    expect(res.status).toBe(403);
  });

  it('rejects video content missing videoUrl', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const res = await http()
      .post(`/v1/courses/${course._id.toString()}/modules`)
      .set(bearer(at))
      .send({
        title: 'Vid',
        order: 0,
        content: [{ kind: 'video', title: 'v' }],
      });
    expect(res.status).toBe(422);
  });
});
