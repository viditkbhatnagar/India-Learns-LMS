import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import {
  generateOpaqueToken,
  sha256,
  signAccessToken,
  verifyAccessToken,
} from '../../src/services/tokenService.js';

function stubUser() {
  return {
    _id: new Types.ObjectId(),
    role: 'student' as const,
    status: 'active' as const,
    batchId: null,
  } as never;
}

describe('tokenService', () => {
  it('signs and verifies a JWT round-trip', async () => {
    const user = stubUser();
    const { token, expiresIn } = await signAccessToken(user);
    expect(typeof token).toBe('string');
    expect(expiresIn).toBeGreaterThan(0);
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe(String(user._id));
    expect(claims.role).toBe('student');
    expect(claims.status).toBe('active');
    expect(claims.iss).toBe('il');
    expect(claims.aud).toBe('web');
  });

  it('rejects a tampered token', async () => {
    const user = stubUser();
    const { token } = await signAccessToken(user);
    const mangled = `${token.slice(0, -4)}XXXX`;
    await expect(verifyAccessToken(mangled)).rejects.toThrow(/Invalid or expired/);
  });

  it('produces base64url opaque tokens and stable hashes', () => {
    const { plain, tokenHash } = generateOpaqueToken();
    expect(plain).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(plain.length).toBeGreaterThanOrEqual(42);
    expect(tokenHash).toHaveLength(64);
    expect(sha256(plain)).toBe(tokenHash);
  });

  it('generates unique tokens', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const { plain } = generateOpaqueToken();
      expect(seen.has(plain)).toBe(false);
      seen.add(plain);
    }
  });
});
