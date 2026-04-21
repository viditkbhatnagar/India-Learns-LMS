import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import {
  istDateStringFromUtc,
  istDayOfWeek,
  istDayOffset,
  istDayRange,
  istWallClockIso,
  parseIsoWeek,
  utcDateForIstDay,
} from '../../src/services/timetableTz.js';

describe('timetableTz', () => {
  it('converts IST YMD → UTC instant of IST midnight', () => {
    // 2026-08-15 IST = 2026-08-14T18:30:00Z
    expect(utcDateForIstDay('2026-08-15').toISOString()).toBe(
      '2026-08-14T18:30:00.000Z',
    );
  });

  it('round-trips UTC → IST YMD', () => {
    // 2026-08-14T20:00:00Z is 2026-08-15T01:30:00 IST → "2026-08-15"
    expect(
      istDateStringFromUtc(new Date('2026-08-14T20:00:00.000Z')),
    ).toBe('2026-08-15');
  });

  it('emits IST wall-clock ISO with +05:30 suffix', () => {
    expect(istWallClockIso('2026-07-30', 18 * 60)).toBe(
      '2026-07-30T18:00:00+05:30',
    );
    expect(istWallClockIso('2026-07-30', 19 * 60 + 30)).toBe(
      '2026-07-30T19:30:00+05:30',
    );
  });

  it('computes IST day-of-week correctly around midnight', () => {
    // 2026-08-15 IST = Saturday = 6
    expect(istDayOfWeek(utcDateForIstDay('2026-08-15'))).toBe(6);
    // 2026-08-17 IST = Monday = 1
    expect(istDayOfWeek(utcDateForIstDay('2026-08-17'))).toBe(1);
  });

  it('advances IST days without DST drift', () => {
    expect(istDayOffset('2026-07-30', 1)).toBe('2026-07-31');
    expect(istDayOffset('2026-07-31', 1)).toBe('2026-08-01');
    expect(istDayOffset('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('enumerates IST day range inclusively', () => {
    expect(istDayRange('2026-07-30', '2026-08-02')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('parses ISO week into IST Monday–Sunday span', () => {
    const parsed = parseIsoWeek('2026-W30');
    // ISO 2026-W30 starts Monday 2026-07-20.
    expect(parsed.fromIst).toBe('2026-07-20');
    expect(parsed.toIst).toBe('2026-07-26');
  });
});
