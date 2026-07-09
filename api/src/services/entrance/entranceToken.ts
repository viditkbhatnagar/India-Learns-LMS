import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { loadEnv } from '../../config/env.js';
import { HttpError } from '../../middleware/error.js';
import { parseTtl } from '../../utils/time.js';
import type { HydratedEntranceCandidate } from '../../models/index.js';

// Entrance candidate tokens use a DISTINCT audience so they can never be used on
// the normal `/v1` app routes (which verify audience 'web'), and normal user
// tokens can never be used on `/v1/entrance/*`. Same JWT_SECRET, separate realm.
const ISSUER = 'il';
const AUDIENCE = 'entrance';

export interface EntranceTokenClaims extends JWTPayload {
  sub: string;
  examId: string;
  kind: 'entrance_candidate';
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(loadEnv().JWT_SECRET);
}

export async function signEntranceToken(
  candidate: HydratedEntranceCandidate,
): Promise<{ token: string; expiresIn: number }> {
  const env = loadEnv();
  const expiresIn = parseTtl(env.ENTRANCE_TOKEN_TTL);
  const now = Math.floor(Date.now() / 1000);
  const jti = randomBytes(12).toString('base64url');
  const token = await new SignJWT({
    examId: String(candidate.examId),
    kind: 'entrance_candidate',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(String(candidate._id))
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(expiresIn / 1000))
    .sign(secretKey());
  return { token, expiresIn: Math.floor(expiresIn / 1000) };
}

export async function verifyEntranceToken(token: string): Promise<EntranceTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || payload.kind !== 'entrance_candidate') {
      throw new Error('missing/invalid entrance claims');
    }
    return payload as EntranceTokenClaims;
  } catch {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Invalid or expired entrance session.');
  }
}
