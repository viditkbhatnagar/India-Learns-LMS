import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeAdmin, makeUser } from '../helpers/factories.js';
import { User } from '../../src/models/index.js';
import { http } from '../helpers/http.js';

describe('POST /v1/auth/login', () => {
  useMongo();
  useIntegrationSpies();

  it('returns 200 + access token + refresh cookie on correct credentials', async () => {
    const { user, password } = await makeAdmin();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password, deviceId: 'dev' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(user.email);
    const cookies = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    const arr = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
    expect(arr.some((c) => c.startsWith('__Host-il_rt='))).toBe(true);
  });

  it('returns 401 on bad password and increments loginFailCount', async () => {
    const { user, password: _password } = await makeAdmin();
    void _password;
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'WrongPass#123', deviceId: 'dev' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    const reloaded = await User.findById(user._id);
    expect(reloaded!.loginFailCount).toBe(1);
  });

  it('locks the account after LOGIN_LOCK_AFTER failures', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    // Bypass the per-ip/email rate-limit by sweeping failures across different emails of the same account.
    // Simpler: drive it via the service directly.
    const { login } = await import('../../src/services/authService.js');
    for (let i = 0; i < 10; i += 1) {
       
      await login(user.email, 'wrong', { ip: '10.0.0.1', ua: 't', deviceId: 'd' }).catch(() => undefined);
    }
    const reloaded = await User.findById(user._id);
    expect(reloaded!.lockedUntil).not.toBeNull();
    expect(reloaded!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns SUSPENDED_ACCESS when the account is manually suspended', async () => {
    const user = await makeUser({
      password: 'Correct#12345',
      status: 'suspended',
    });
    user.suspensionKind = 'manual';
    await user.save();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Correct#12345', deviceId: 'dev' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUSPENDED_ACCESS');
  });

  it('allows a fees-suspended student to log in (PRD §3.2)', async () => {
    const user = await makeUser({
      password: 'Correct#12345',
      status: 'suspended',
    });
    user.suspensionKind = 'fees';
    user.suspensionReason = '28 days overdue';
    await user.save();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Correct#12345', deviceId: 'dev' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('suspended');
    expect(res.body.data.user.suspensionKind).toBe('fees');
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects access tokens that have expired', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    const { SignJWT } = await import('jose');
    const env = (await import('../../src/config/env.js')).loadEnv();
    const expired = await new SignJWT({ role: user.role, status: user.status, batchId: null })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('il')
      .setAudience('web')
      .setSubject(String(user._id))
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    const res = await http()
      .get('/v1/users/me')
      .set('authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('refuses login for a soft-deleted user', async () => {
    const user = await makeUser({ password: 'Correct#12345', status: 'revoked' });
    user.deletedAt = new Date();
    await user.save();
    const res = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Correct#12345', deviceId: 'dev' });
    expect(res.status).toBe(401);
  });
});
