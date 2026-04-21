import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { makeUser } from '../helpers/factories.js';
import { RefreshToken } from '../../src/models/index.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../../src/services/refreshTokenService.js';

const ctx = { deviceId: 'dev-1', ua: 'vitest', ip: '127.0.0.1' };

describe('refreshTokenService', () => {
  useMongo();

  it('issues a new refresh token with a family id', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const issued = await issueRefreshToken(user, ctx);
    expect(issued.plain.length).toBeGreaterThan(40);
    const stored = await RefreshToken.findOne({ userId: user._id });
    expect(stored).not.toBeNull();
    expect(stored!.familyId.toString()).toBeTruthy();
    expect(stored!.revokedAt).toBeNull();
  });

  it('rotates a valid token and marks the prior one revoked', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const first = await issueRefreshToken(user, ctx);
    const rotated = await rotateRefreshToken(first.plain, ctx);
    expect(rotated.plain).not.toBe(first.plain);
    const prior = await RefreshToken.findById(first.record._id);
    expect(prior!.revokedAt).not.toBeNull();
    expect(prior!.rotatedToId!.toString()).toBe(rotated.record._id.toString());
    expect(rotated.record.familyId.toString()).toBe(first.record.familyId.toString());
  });

  it('detects reuse and invalidates the whole family', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const first = await issueRefreshToken(user, ctx);
    const second = await rotateRefreshToken(first.plain, ctx);
    await expect(rotateRefreshToken(first.plain, ctx)).rejects.toThrow(/reused/);
    const survivor = await RefreshToken.findById(second.record._id);
    expect(survivor!.revokedAt).not.toBeNull();
  });

  it('enforces the session cap by evicting the oldest active token', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const issued = [] as { plain: string; id: string }[];
    for (let i = 0; i < 6; i += 1) {
      // Space out the createdAt timestamps so sort is deterministic.
       
      const { plain, record } = await issueRefreshToken(user, { ...ctx, deviceId: `d${i}` });
      issued.push({ plain, id: record._id.toString() });
       
      await new Promise((r) => setTimeout(r, 5));
    }
    const activeCount = await RefreshToken.countDocuments({
      userId: user._id,
      revokedAt: null,
    });
    expect(activeCount).toBe(5);
    const firstRecord = await RefreshToken.findById(issued[0]!.id);
    expect(firstRecord!.revokedAt).not.toBeNull();
    await expect(rotateRefreshToken(issued[0]!.plain, ctx)).rejects.toThrow(/reused/);
  });

  it('revokes a refresh token on logout', async () => {
    const user = await makeUser({ password: 'Initial#12345' });
    const { plain, record } = await issueRefreshToken(user, ctx);
    await revokeRefreshToken(plain);
    const after = await RefreshToken.findById(record._id);
    expect(after!.revokedAt).not.toBeNull();
  });
});
