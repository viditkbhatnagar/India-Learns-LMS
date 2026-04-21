import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeUser } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { User } from '../../src/models/index.js';

describe('password reset + change', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('accepts reset request and emails a link when the user exists', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const res = await http()
      .post('/v1/auth/password/reset/request')
      .send({ email: user.email });
    expect(res.status).toBe(202);
    const token = spies.email.lastInviteToken();
    expect(token).toBeTruthy();
  });

  it('returns 202 for unknown emails without leaking existence', async () => {
    const res = await http()
      .post('/v1/auth/password/reset/request')
      .send({ email: 'nobody@nowhere.invalid' });
    expect(res.status).toBe(202);
    expect(spies.email.calls.length).toBe(0);
  });

  it('confirms reset, rejects reuse of the last password', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    await http().post('/v1/auth/password/reset/request').send({ email: user.email });
    const token = spies.email.lastInviteToken();
    expect(token).toBeTruthy();

    // Same as current — must be rejected.
    const reuseAttempt = await http()
      .post('/v1/auth/password/reset/confirm')
      .send({ token, password: 'Initial#12345' });
    expect(reuseAttempt.status).toBe(422);

    // Fresh link — previous was used up by the confirm attempt.
    await http().post('/v1/auth/password/reset/request').send({ email: user.email });
    const freshToken = spies.email.lastInviteToken();

    const confirm = await http()
      .post('/v1/auth/password/reset/confirm')
      .send({ token: freshToken, password: 'Different#12345' });
    expect(confirm.status).toBe(200);

    const reloaded = await User.findById(user._id);
    expect(reloaded!.passwordHash).toBeTruthy();
    expect(reloaded!.loginFailCount).toBe(0);
    expect(reloaded!.lockedUntil).toBeNull();
  });

  it('changes password via authenticated endpoint', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Initial#12345', deviceId: 'dev' });
    const accessToken = login.body.data.accessToken as string;

    const bad = await http()
      .post('/v1/auth/password/change')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ current: 'wrong', next: 'Different#12345' });
    expect(bad.status).toBe(401);

    const good = await http()
      .post('/v1/auth/password/change')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ current: 'Initial#12345', next: 'Different#12345' });
    expect(good.status).toBe(200);

    const reuse = await http()
      .post('/v1/auth/password/change')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ current: 'Different#12345', next: 'Initial#12345' });
    // Access token is still valid (we don't invalidate it), but reuse of the old hash
    // must be rejected.
    expect(reuse.status).toBe(422);
  });
});
