import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { isSecretBoxConfigured, open, seal } from '../../src/utils/secretBox.js';

describe('secretBox', () => {
  it('round-trips seal → open', () => {
    const plain = 'hunter2-abc9';
    const sealed = seal(plain);
    expect(sealed).not.toContain(plain);
    expect(open(sealed)).toBe(plain);
  });

  it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
    expect(seal('same-value-9')).not.toBe(seal('same-value-9'));
  });

  it('rejects a tampered ciphertext (GCM auth)', () => {
    const sealed = seal('topsecret9');
    const parts = sealed.split('.');
    const ctBuf = Buffer.from(parts[1]!, 'base64');
    ctBuf[0] = (ctBuf[0]! + 1) % 256;
    const tampered = [parts[0], ctBuf.toString('base64'), parts[2]].join('.');
    expect(() => open(tampered)).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => open('not-a-sealed-value')).toThrow();
  });

  it('reports configured when the key is set', () => {
    expect(isSecretBoxConfigured()).toBe(true);
  });
});
