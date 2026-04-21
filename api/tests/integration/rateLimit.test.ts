import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeUser } from '../helpers/factories.js';
import { resetEnvCache } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';

let limitedApp: Express;
let previousDisabled: string | undefined;
let previousLoginMax: string | undefined;
let previousResetMax: string | undefined;

describe('rate limiters', () => {
  useMongo();
  useIntegrationSpies();

  beforeAll(() => {
    previousDisabled = process.env.RATE_LIMITS_DISABLED;
    previousLoginMax = process.env.LOGIN_RATE_MAX;
    previousResetMax = process.env.PASSWORD_RESET_RATE_MAX;
    process.env.RATE_LIMITS_DISABLED = 'false';
    process.env.LOGIN_RATE_MAX = '3';
    process.env.PASSWORD_RESET_RATE_MAX = '2';
    resetEnvCache();
    limitedApp = createApp();
  });

  afterAll(() => {
    if (previousDisabled !== undefined) {
      process.env.RATE_LIMITS_DISABLED = previousDisabled;
    } else {
      delete process.env.RATE_LIMITS_DISABLED;
    }
    if (previousLoginMax !== undefined) process.env.LOGIN_RATE_MAX = previousLoginMax;
    if (previousResetMax !== undefined) process.env.PASSWORD_RESET_RATE_MAX = previousResetMax;
    resetEnvCache();
  });

  it('returns 429 on the 4th login attempt for the same (ip, email)', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    const responses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
       
      const res = await request(limitedApp)
        .post('/v1/auth/login')
        .send({ email: user.email, password: 'wrong', deviceId: 'dev' });
      responses.push(res.status);
    }
    expect(responses.slice(0, 3).every((s) => s === 401)).toBe(true);
    expect(responses[3]).toBe(429);
  });

  it('returns 429 on the 3rd password-reset request from the same IP', async () => {
    const user = await makeUser({ password: 'Correct#12345' });
    const first = await request(limitedApp)
      .post('/v1/auth/password/reset/request')
      .send({ email: user.email });
    const second = await request(limitedApp)
      .post('/v1/auth/password/reset/request')
      .send({ email: user.email });
    const third = await request(limitedApp)
      .post('/v1/auth/password/reset/request')
      .send({ email: user.email });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});
