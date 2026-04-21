import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeFaculty,
  makeStudent,
  makeUser,
  makeCourse,
  makeProgram,
} from '../helpers/factories.js';
import { Program } from '../../src/models/index.js';

describe('programs CRUD', () => {
  useMongo();
  useIntegrationSpies();

  it('admin can create, list, fetch, patch, and delete a program', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);

    const created = await http()
      .post('/v1/programs')
      .set(bearer(at))
      .send({ name: 'Aviation Diploma', slug: 'aviation-diploma' });
    expect(created.status).toBe(201);
    expect(created.body.data.program.slug).toBe('aviation-diploma');
    expect(created.body.data.program.totalHours).toBe(300);

    const list = await http().get('/v1/programs').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);

    const fetched = await http()
      .get(`/v1/programs/${created.body.data.program.id}`)
      .set(bearer(at));
    expect(fetched.status).toBe(200);

    const patched = await http()
      .patch(`/v1/programs/${created.body.data.program.id}`)
      .set(bearer(at))
      .send({ description: 'Updated description' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.program.description).toBe('Updated description');

    const del = await http()
      .delete(`/v1/programs/${created.body.data.program.id}`)
      .set(bearer(at));
    expect(del.status).toBe(200);
    expect(del.body.data.program.deletedAt).not.toBeNull();
  });

  it('duplicate slug returns 409 SLUG_EXISTS', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    await http().post('/v1/programs').set(bearer(at)).send({ name: 'A', slug: 'aviation' });
    const res = await http()
      .post('/v1/programs')
      .set(bearer(at))
      .send({ name: 'B', slug: 'aviation' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_EXISTS');
  });

  it('faculty may GET but 403 on POST/PATCH/DELETE', async () => {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);

    const listed = await http().get('/v1/programs').set(bearer(at));
    expect(listed.status).toBe(200);

    const post = await http()
      .post('/v1/programs')
      .set(bearer(at))
      .send({ name: 'x', slug: 'x' });
    expect(post.status).toBe(403);
  });

  it('student 403 on GET programs (not in role allowlist)', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http().get('/v1/programs').set(bearer(at));
    expect(res.status).toBe(403);
  });

  it('refuses to delete a program that still has courses', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    await makeCourse({ programId: program._id });
    const res = await http()
      .delete(`/v1/programs/${program._id.toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PROGRAM_IN_USE');
  });

  it('non-admin staff (superadmin) cannot create', async () => {
    const su = await makeUser({ role: 'superadmin', password: 'Admin#1234567' });
    const at = await tokenFor(su);
    const res = await http()
      .post('/v1/programs')
      .set(bearer(at))
      .send({ name: 'x', slug: 'x-sa' });
    expect(res.status).toBe(403);
  });

  it('seeded programs appear via GET /v1/programs', async () => {
    await Program.create({ slug: 'aviation-diploma', name: 'Aviation Diploma' });
    await Program.create({ slug: 'retail-fashion-diploma', name: 'Retail & Fashion Diploma' });
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http().get('/v1/programs').set(bearer(at));
    const slugs = (res.body.data.items as Array<{ slug: string }>).map((p) => p.slug).sort();
    expect(slugs).toEqual(['aviation-diploma', 'retail-fashion-diploma']);
  });
});
