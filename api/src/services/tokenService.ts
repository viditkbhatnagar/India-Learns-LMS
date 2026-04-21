import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import type { UserDoc } from '../models/index.js';
import { parseTtl } from '../utils/time.js';

const ISSUER = 'il';
const AUDIENCE = 'web';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;
  role: UserDoc['role'];
  status: UserDoc['status'];
  batchId: string | null;
}

function secretKey(): Uint8Array {
  const env = loadEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAccessToken(user: UserDoc): Promise<{
  token: string;
  expiresIn: number;
}> {
  const env = loadEnv();
  const expiresIn = parseTtl(env.JWT_ACCESS_TTL);
  const now = Math.floor(Date.now() / 1000);
  const jti = randomBytes(12).toString('base64url');
  const token = await new SignJWT({
    role: user.role,
    status: user.status,
    batchId: user.batchId ? String(user.batchId) : null,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(String(user._id))
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(expiresIn / 1000))
    .sign(secretKey());
  return { token, expiresIn: Math.floor(expiresIn / 1000) };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string') {
      throw new Error('missing sub');
    }
    return payload as AccessTokenClaims;
  } catch {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired token.');
  }
}

export function generateOpaqueToken(): { plain: string; tokenHash: string } {
  const plain = randomBytes(32).toString('base64url');
  return { plain, tokenHash: sha256(plain) };
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
