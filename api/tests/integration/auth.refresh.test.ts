import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeUser } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import { REFRESH_COOKIE_NAME } from '../../src/utils/cookies.js';
import { RefreshToken } from '../../src/models/index.js';

function extractRefreshCookie(setCookie: string[] | string | undefined): string | null {
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const entry of arr) {
    const match = new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`).exec(entry);
    if (match) return match[1]!;
  }
  return null;
}

describe('POST /v1/auth/refresh + /logout', () => {
  useMongo();
  useIntegrationSpies();

  it('rotates the refresh cookie and returns a fresh access token', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Correct#12345', deviceId: 'dev' });
    const initialRt = extractRefreshCookie(login.headers['set-cookie'] as string[] | string | undefined);
    expect(initialRt).toBeTruthy();

    const refreshed = await http()
      .post('/v1/auth/refresh')
      .set('cookie', `${REFRESH_COOKIE_NAME}=${initialRt}`)
      .send({ deviceId: 'dev' });
    expect(refreshed.status).toBe(200);
    const nextRt = extractRefreshCookie(refreshed.headers['set-cookie'] as string[] | string | undefined);
    expect(nextRt).toBeTruthy();
    expect(nextRt).not.toBe(initialRt);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    // Reusing the old token must revoke the family.
    const reused = await http()
      .post('/v1/auth/refresh')
      .set('cookie', `${REFRESH_COOKIE_NAME}=${initialRt}`)
      .send({ deviceId: 'dev' });
    expect(reused.status).toBe(401);

    const active = await RefreshToken.countDocuments({
      userId: user._id,
      revokedAt: null,
    });
    expect(active).toBe(0);
  });

  it('logs out by revoking the current refresh token', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    const login = await http()
      .post('/v1/auth/login')
      .send({ email: user.email, password: 'Correct#12345', deviceId: 'dev' });
    const rt = extractRefreshCookie(login.headers['set-cookie'] as string[] | string | undefined);
    const accessToken = login.body.data.accessToken;

    const logout = await http()
      .post('/v1/auth/logout')
      .set('cookie', `${REFRESH_COOKIE_NAME}=${rt}`)
      .set('authorization', `Bearer ${accessToken}`);
    expect(logout.status).toBe(204);

    const refreshAfter = await http()
      .post('/v1/auth/refresh')
      .set('cookie', `${REFRESH_COOKIE_NAME}=${rt}`)
      .send({ deviceId: 'dev' });
    expect(refreshAfter.status).toBe(401);
  });
});
