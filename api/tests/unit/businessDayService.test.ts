import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { makeHoliday } from '../helpers/factories.js';
import {
  addBusinessDays,
  addBusinessDaysWithLoad,
  isBusinessDay,
  loadHolidaySet,
} from '../../src/services/businessDayService.js';
import { utcDateForIstDay } from '../../src/services/timetableTz.js';

describe('businessDayService', () => {
  useMongo();

  it('rejects weekends', () => {
    // 2026-07-04 is a Saturday IST, 2026-07-05 a Sunday.
    expect(isBusinessDay(utcDateForIstDay('2026-07-04'), { days: new Set() })).toBe(false);
    expect(isBusinessDay(utcDateForIstDay('2026-07-05'), { days: new Set() })).toBe(false);
    expect(isBusinessDay(utcDateForIstDay('2026-07-06'), { days: new Set() })).toBe(true);
  });

  it('honours a loaded Holiday set', async () => {
    await makeHoliday({ istDate: '2026-08-15', name: 'Independence Day' });
    const from = utcDateForIstDay('2026-08-01');
    const to = utcDateForIstDay('2026-08-31');
    const holidays = await loadHolidaySet(from, to);
    expect(holidays.days.has('2026-08-15')).toBe(true);
    expect(isBusinessDay(utcDateForIstDay('2026-08-14'), holidays)).toBe(true);
    expect(isBusinessDay(utcDateForIstDay('2026-08-15'), holidays)).toBe(false);
  });

  it('adds business days skipping weekends', () => {
    // 2026-07-06 is a Monday; +5 bd lands next Monday 2026-07-13.
    const start = utcDateForIstDay('2026-07-06');
    const deadline = addBusinessDays(start, 5, { days: new Set() });
    expect(deadline.toISOString()).toBe(utcDateForIstDay('2026-07-13').toISOString());
  });

  it('skips a holiday falling mid-window', () => {
    // Monday 2026-08-10 + 5 bd, normally 2026-08-17. 15 Aug is a Saturday so
    // no shift, but 14 Aug (Fri) is still a business day so we test a holiday
    // on 12 Aug (Wed) which shifts the deadline forward by a day.
    const start = utcDateForIstDay('2026-08-10');
    const holidays = { days: new Set(['2026-08-12']) };
    const deadline = addBusinessDays(start, 5, holidays);
    expect(deadline.toISOString()).toBe(utcDateForIstDay('2026-08-18').toISOString());
  });

  it('addBusinessDays(0) returns a copy of start', () => {
    const start = utcDateForIstDay('2026-07-06');
    const out = addBusinessDays(start, 0, { days: new Set() });
    expect(out.getTime()).toBe(start.getTime());
    expect(out).not.toBe(start);
  });

  it('rejects negative input', () => {
    expect(() =>
      addBusinessDays(new Date(), -1, { days: new Set() }),
    ).toThrow(/non-negative/);
  });

  it('addBusinessDaysWithLoad covers 15 business days for complaints', async () => {
    // Friday 2026-07-03 + 15 bd, no holidays. 15 bd lands on Friday 2026-07-24.
    const start = utcDateForIstDay('2026-07-03');
    const deadline = await addBusinessDaysWithLoad(start, 15);
    expect(deadline.toISOString()).toBe(utcDateForIstDay('2026-07-24').toISOString());
  });

  it('addBusinessDaysWithLoad skips seeded 15 Aug holiday in a 15bd window', async () => {
    await makeHoliday({ istDate: '2026-08-15', name: 'Independence Day' });
    // 15 Aug 2026 is a Saturday — already not a business day. Seed a weekday
    // holiday to prove the loader actually applies.
    await makeHoliday({ istDate: '2026-08-12', name: 'Demo weekday holiday' });
    const start = utcDateForIstDay('2026-07-31'); // Fri
    const deadline = await addBusinessDaysWithLoad(start, 15);
    // 15 bd from Fri 31 Jul, skipping Wed 12 Aug, lands on Mon 24 Aug.
    expect(deadline.toISOString()).toBe(utcDateForIstDay('2026-08-24').toISOString());
  });
});
