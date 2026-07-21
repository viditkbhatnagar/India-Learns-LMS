import { describe, expect, it } from 'vitest';
import { normalizeE164Loose } from '../../src/utils/phone.js';

describe('normalizeE164Loose', () => {
  it('normalizes a bare 10-digit Indian number to +91 (the reported bug)', () => {
    expect(normalizeE164Loose('9249551757')).toBe('+919249551757');
  });

  it('handles spaces / dashes / parens', () => {
    expect(normalizeE164Loose('92495 51757')).toBe('+919249551757');
    expect(normalizeE164Loose('98123-45678')).toBe('+919812345678');
  });

  it('strips a leading domestic 0', () => {
    expect(normalizeE164Loose('09249551757')).toBe('+919249551757');
  });

  it('keeps an already-E.164 number', () => {
    expect(normalizeE164Loose('+919812345678')).toBe('+919812345678');
    expect(normalizeE164Loose('+91 98123 45678')).toBe('+919812345678');
  });

  it('handles a 91-prefixed 12-digit number', () => {
    expect(normalizeE164Loose('919249551757')).toBe('+919249551757');
  });

  it('handles a 00-international prefix', () => {
    expect(normalizeE164Loose('00447911123456')).toBe('+447911123456');
  });

  it('rejects too-short / non-numeric / empty', () => {
    expect(normalizeE164Loose('12345')).toBeNull();
    expect(normalizeE164Loose('abcdefghij')).toBeNull();
    expect(normalizeE164Loose('')).toBeNull();
  });
});
