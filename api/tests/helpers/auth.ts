import type { UserDoc } from '../../src/models/index.js';
import { signAccessToken } from '../../src/services/tokenService.js';

/**
 * Issue a bearer token for a user directly via the token service. Skips the
 * refresh-token cookie dance since most M3 tests only need the bearer.
 */
export async function tokenFor(user: UserDoc): Promise<string> {
  const { token } = await signAccessToken(user);
  return token;
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
