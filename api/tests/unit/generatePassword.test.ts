import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { generatePassword } from '../../src/utils/generatePassword.js';
import { validatePolicy } from '../../src/services/passwordService.js';

describe('generatePassword', () => {
  it('always satisfies the password policy', () => {
    for (let i = 0; i < 100; i += 1) {
      const pw = generatePassword();
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(() => validatePolicy(pw)).not.toThrow();
    }
  });

  it('produces different values each call', () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});
