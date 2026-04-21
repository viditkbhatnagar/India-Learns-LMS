import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import {
  assertNotReused,
  hashPassword,
  rotateHistory,
  validatePolicy,
  verifyPassword,
} from '../../src/services/passwordService.js';

describe('passwordService', () => {
  describe('validatePolicy', () => {
    it('accepts a strong password', () => {
      expect(() => validatePolicy('GoodPass1X!')).not.toThrow();
    });

    it('rejects short passwords', () => {
      expect(() => validatePolicy('Ab1234')).toThrow(/10 characters/);
    });

    it('rejects passwords without digits', () => {
      expect(() => validatePolicy('NoDigitsHere!')).toThrow(/letter and one digit/);
    });

    it('rejects passwords without letters', () => {
      expect(() => validatePolicy('123456789012')).toThrow(/letter and one digit/);
    });
  });

  describe('hash + verify', () => {
    it('round-trips a password', async () => {
      const hash = await hashPassword('Correct1Horse!');
      expect(hash.startsWith('$argon2id$')).toBe(true);
      await expect(verifyPassword(hash, 'Correct1Horse!')).resolves.toBe(true);
      await expect(verifyPassword(hash, 'wrong')).resolves.toBe(false);
    });

    it('returns false on null hash', async () => {
      await expect(verifyPassword(null, 'anything')).resolves.toBe(false);
    });
  });

  describe('assertNotReused', () => {
    it('rejects a password that matches the current hash', async () => {
      const hash = await hashPassword('Reuse#12345');
      await expect(
        assertNotReused({ passwordHash: hash, passwordHistoryHashes: [] }, 'Reuse#12345'),
      ).rejects.toThrow(/last three/);
    });

    it('rejects a password that matches a historical hash', async () => {
      const hashA = await hashPassword('OldPass#123');
      const hashB = await hashPassword('CurrentPass#123');
      await expect(
        assertNotReused(
          { passwordHash: hashB, passwordHistoryHashes: [hashA] },
          'OldPass#123',
        ),
      ).rejects.toThrow();
    });

    it('accepts a novel password', async () => {
      const hash = await hashPassword('Different#123');
      await expect(
        assertNotReused({ passwordHash: hash, passwordHistoryHashes: [] }, 'Fresh#12345'),
      ).resolves.toBeUndefined();
    });
  });

  describe('rotateHistory', () => {
    it('keeps only the most recent three hashes', () => {
      const next = rotateHistory(['b', 'c', 'd'], 'a');
      expect(next).toEqual(['a', 'b', 'c']);
    });

    it('returns the input when previous is null', () => {
      expect(rotateHistory(['b'], null)).toEqual(['b']);
    });
  });
});
