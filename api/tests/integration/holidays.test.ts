import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeStudent } from '../helpers/factories.js';

describe('/v1/holidays', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates and lists holidays', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const create = await http()
      .post('/v1/holidays')
      .set(bearer(at))
      .send({ date: '2026-08-15', name: 'Independence Day' });
    expect(create.status).toBe(201);
    expect(create.body.data.holiday.kind).toBe('public');

    const list = await http().get('/v1/holidays').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
  });

  it('duplicate date rejected with HOLIDAY_DUPLICATE', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    await http()
      .post('/v1/holidays')
      .set(bearer(at))
      .send({ date: '2026-08-15', name: 'Independence Day' });
    const dup = await http()
      .post('/v1/holidays')
      .set(bearer(at))
      .send({ date: '2026-08-15', name: 'Duplicate' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('HOLIDAY_DUPLICATE');
  });

  it('student cannot create a holiday', async () => {
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/holidays')
      .set(bearer(at))
      .send({ date: '2026-08-15', name: 'X' });
    expect(res.status).toBe(403);
  });
});
