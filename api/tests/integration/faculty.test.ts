import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeStudent } from '../helpers/factories.js';

interface FacultyRow {
  id: string;
  email: string;
  password: string | null;
  role?: unknown;
}

describe('faculty account routes', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates a faculty login that can then actually log in', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);

    const created = await http()
      .post('/v1/faculty')
      .set(bearer(at))
      .send({ name: 'Priya Menon', email: 'priya@luc.local', phoneE164: '+91 98123 45678' });
    expect(created.status).toBe(201);
    const { faculty, temporaryPassword } = created.body.data as {
      faculty: FacultyRow;
      temporaryPassword: string;
    };
    expect(faculty.email).toBe('priya@luc.local');
    expect(faculty.role).toBeUndefined(); // FacultyAccountDto exposes no role/hash
    expect(temporaryPassword).toBeTruthy();
    expect(faculty.password).toBe(temporaryPassword);

    // The generated credentials work at the real login endpoint.
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'priya@luc.local', password: temporaryPassword, deviceId: 'test-device' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('faculty');
  });

  it('lists faculty with the persisted (decrypted) password', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const created = await http()
      .post('/v1/faculty')
      .set(bearer(at))
      .send({ name: 'A B', email: 'ab@luc.local', phoneE164: '+919812345611' });

    const list = await http().get('/v1/faculty').set(bearer(at));
    expect(list.status).toBe(200);
    const row = (list.body.data.items as FacultyRow[]).find((f) => f.email === 'ab@luc.local');
    expect(row?.password).toBe(created.body.data.temporaryPassword);
  });

  it('reset-password issues a new working password', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const created = await http()
      .post('/v1/faculty')
      .set(bearer(at))
      .send({ name: 'R S', email: 'rs@luc.local', phoneE164: '+919812345612' });
    const id = created.body.data.faculty.id as string;

    const reset = await http().post(`/v1/faculty/${id}/reset-password`).set(bearer(at)).send({});
    expect(reset.status).toBe(200);
    const next = reset.body.data.temporaryPassword as string;
    expect(next).not.toBe(created.body.data.temporaryPassword);

    const login = await http()
      .post('/v1/auth/login')
      .send({ email: 'rs@luc.local', password: next, deviceId: 'd' });
    expect(login.status).toBe(200);
  });

  it('is forbidden for students (403) and unauthenticated (401)', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    expect((await http().get('/v1/faculty').set(bearer(at))).status).toBe(403);
    expect(
      (
        await http()
          .post('/v1/faculty')
          .set(bearer(at))
          .send({ name: 'X', email: 'x@x.com', phoneE164: '+919812345613' })
      ).status,
    ).toBe(403);
    expect((await http().get('/v1/faculty')).status).toBe(401);
  });
});
