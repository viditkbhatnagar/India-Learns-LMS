import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';

// Reversible symmetric encryption for admin-recoverable secrets (faculty
// passwords). AES-256-GCM: authenticated (tamper-evident) + confidential.
//
// The key is derived by SHA-256 over CREDENTIALS_ENC_KEY, so any sufficiently
// long random string works as the configured value (no hex/base64 parsing).
// Sealed format: base64(iv).base64(ciphertext).base64(authTag).
//
// This makes a raw DB dump useless without the app's env key. It does NOT
// protect against an attacker who also has the running app/env — recoverable
// storage is an accepted product tradeoff (admins must be able to re-read
// faculty passwords).

const IV_BYTES = 12; // GCM standard nonce length
const MIN_KEY_SOURCE_LEN = 16;

function key(): Buffer {
  const raw = loadEnv().CREDENTIALS_ENC_KEY;
  if (!raw || raw.length < MIN_KEY_SOURCE_LEN) {
    throw new HttpError(
      503,
      'CREDENTIALS_NOT_CONFIGURED',
      'Faculty credential storage is not configured. Set a strong CREDENTIALS_ENC_KEY (≥16 chars).',
    );
  }
  return createHash('sha256').update(raw, 'utf8').digest(); // 32 bytes
}

/** Is the credential-encryption key configured? (For feature availability checks.) */
export function isSecretBoxConfigured(): boolean {
  const raw = loadEnv().CREDENTIALS_ENC_KEY;
  return Boolean(raw) && raw.length >= MIN_KEY_SOURCE_LEN;
}

/** Encrypt `plain` → sealed string (safe to persist). */
export function seal(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${ct.toString('base64')}.${tag.toString('base64')}`;
}

/** Decrypt a sealed string → plaintext. Throws if tampered or key mismatched. */
export function open(sealed: string): string {
  const parts = sealed.split('.');
  if (parts.length !== 3) {
    throw new HttpError(500, 'CREDENTIAL_DECRYPT_FAILED', 'Malformed sealed credential.');
  }
  const [ivB64, ctB64, tagB64] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64!, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64!, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, 'CREDENTIAL_DECRYPT_FAILED', 'Could not decrypt stored credential.');
  }
}
