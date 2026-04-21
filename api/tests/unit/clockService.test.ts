import { afterEach, describe, expect, it } from 'vitest';
import {
  advanceTestNow,
  nowUtc,
  resetClock,
  setTestNow,
} from '../../src/services/clockService.js';

describe('clockService', () => {
  afterEach(() => {
    resetClock();
  });

  it('returns wall-clock time by default', () => {
    const before = Date.now();
    const now = nowUtc().getTime();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after + 10);
  });

  it('honours setTestNow', () => {
    const t = new Date('2030-01-01T00:00:00Z');
    setTestNow(t);
    expect(nowUtc().toISOString()).toBe('2030-01-01T00:00:00.000Z');
  });

  it('returns independent Date instances', () => {
    const t = new Date('2030-01-01T00:00:00Z');
    setTestNow(t);
    const a = nowUtc();
    a.setUTCFullYear(2099);
    expect(nowUtc().getUTCFullYear()).toBe(2030);
  });

  it('advances by ms increments', () => {
    setTestNow(new Date('2030-01-01T00:00:00Z'));
    advanceTestNow(86_400_000);
    expect(nowUtc().toISOString()).toBe('2030-01-02T00:00:00.000Z');
  });

  it('resetClock clears override', () => {
    setTestNow(new Date('2000-01-01T00:00:00Z'));
    resetClock();
    const yearNow = new Date().getUTCFullYear();
    expect(nowUtc().getUTCFullYear()).toBe(yearNow);
  });

  it('advanceTestNow without setTestNow throws', () => {
    expect(() => advanceTestNow(1000)).toThrow();
  });
});
