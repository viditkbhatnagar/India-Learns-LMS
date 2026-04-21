import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeAdmin } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { REFRESH_COOKIE_NAME } from '../../src/utils/cookies.js';

describe('magic-link invite flow', () => {
  useMongo();
  const spies = useIntegrationSpies();

  async function adminAccessToken(): Promise<string> {
    const { user, password } = await makeAdmin();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password, deviceId: 'dev-admin' });
    expect(res.status).toBe(200);
    return res.body.data.accessToken as string;
  }

  it('creates a student, emails an invite, accepts it, returns tokens', async () => {
    const adminToken = await adminAccessToken();

    const created = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        role: 'student',
        name: 'Asha R',
        email: 'asha@example.com',
        phoneE164: '+919999000001',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.user.code).toMatch(/^IL-\d{4}-0001$/);
    expect(created.body.data.user.status).toBe('pending');

    expect(spies.email.calls.length).toBeGreaterThan(0);
    const token = spies.email.lastInviteToken();
    expect(token).toBeTruthy();

    const accepted = await http()
      .post('/v1/auth/invite/accept')
      .send({ token, password: 'Welcome#12345', deviceId: 'dev-stu' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.user.status).toBe('active');
    expect(accepted.body.data.accessToken).toBeTruthy();
    const cookies = accepted.headers['set-cookie'] as unknown as string[] | string | undefined;
    const cookieArr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
    expect(cookieArr.some((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`))).toBe(true);
  });

  it('rejects duplicate email creation with USER_EXISTS', async () => {
    const adminToken = await adminAccessToken();
    await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        role: 'student',
        name: 'One',
        email: 'dup@example.com',
        phoneE164: '+919999000010',
      });
    const second = await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        role: 'student',
        name: 'Two',
        email: 'dup@example.com',
        phoneE164: '+919999000011',
      });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('USER_EXISTS');
  });

  it('rejects a reused magic-link token as TOKEN_USED', async () => {
    const adminToken = await adminAccessToken();
    await http()
      .post('/v1/users')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        role: 'student',
        name: 'Single Use',
        email: 'single@example.com',
        phoneE164: '+919999000020',
      });
    const token = spies.email.lastInviteToken();
    const first = await http()
      .post('/v1/auth/invite/accept')
      .send({ token, password: 'Welcome#12345', deviceId: 'dev-a' });
    expect(first.status).toBe(200);
    const second = await http()
      .post('/v1/auth/invite/accept')
      .send({ token, password: 'Welcome#12345', deviceId: 'dev-b' });
    expect(second.status).toBe(410);
    expect(second.body.error.code).toBe('TOKEN_USED');
  });
});
