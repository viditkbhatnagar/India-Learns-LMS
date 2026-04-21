import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const INDIA_TZ = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330;

export function istDateStringFromUtc(d: Date): string {
  return formatInTimeZone(d, INDIA_TZ, 'yyyy-MM-dd');
}

/**
 * Returns the UTC `Date` that corresponds to `00:00:00 IST` on the given
 * `YYYY-MM-DD` calendar day. India has no DST so the offset is a constant
 * `+05:30` — the subtraction is safe.
 */
export function utcDateForIstDay(ymd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) throw new Error(`Invalid IST date string: ${ymd}`);
  const [, y, m, day] = match;
  const utcMs = Date.UTC(Number(y), Number(m) - 1, Number(day), 0, 0, 0, 0);
  return new Date(utcMs - IST_OFFSET_MINUTES * 60_000);
}

/**
 * Returns an ISO-8601 string with literal `+05:30` suffix for the given IST
 * calendar day + minutes-from-midnight. Example: `2026-07-30T18:00:00+05:30`.
 */
export function istWallClockIso(
  istYmd: string,
  minutesFromMidnight: number,
): string {
  if (minutesFromMidnight < 0 || minutesFromMidnight > 1440) {
    throw new Error(`minutesFromMidnight out of range: ${minutesFromMidnight}`);
  }
  const hh = Math.floor(minutesFromMidnight / 60);
  const mm = minutesFromMidnight % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${istYmd}T${pad(hh)}:${pad(mm)}:00+05:30`;
}

export function istDayOfWeek(d: Date): number {
  const zoned = toZonedTime(d, INDIA_TZ);
  return zoned.getDay();
}

/**
 * Builds an IST-midnight UTC Date for the day identified by iterating `offset`
 * days from the IST calendar day of `from`. Non-mutating.
 */
export function istDayOffset(fromIstYmd: string, offsetDays: number): string {
  const base = utcDateForIstDay(fromIstYmd);
  const shifted = new Date(base.getTime() + offsetDays * 86_400_000);
  return istDateStringFromUtc(shifted);
}

/** Inclusive list of IST `YYYY-MM-DD` strings in `[from, to]`. */
export function istDayRange(fromIstYmd: string, toIstYmd: string): string[] {
  const out: string[] = [];
  let cursor = fromIstYmd;
  for (let i = 0; i < 366; i += 1) {
    out.push(cursor);
    if (cursor === toIstYmd) return out;
    cursor = istDayOffset(cursor, 1);
  }
  throw new Error(`istDayRange: window exceeded 366 days (${fromIstYmd}..${toIstYmd})`);
}

/**
 * Parses an ISO week string like `2026-W30` and returns the UTC Date bounds
 * covering Monday 00:00 IST … Sunday 23:59:59.999 IST of that ISO week.
 */
export function parseIsoWeek(week: string): { fromUtc: Date; toUtc: Date; fromIst: string; toIst: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) throw new Error(`Invalid ISO week: ${week}`);
  const year = Number(match[1]);
  const weekNum = Number(match[2]);
  if (weekNum < 1 || weekNum > 53) {
    throw new Error(`Invalid ISO week number: ${weekNum}`);
  }
  // ISO week 1 is the week containing the first Thursday of the year.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Sun=0 → 7
  const week1Monday = new Date(jan4.getTime() - (jan4Dow - 1) * 86_400_000);
  const weekMondayUtc = new Date(week1Monday.getTime() + (weekNum - 1) * 7 * 86_400_000);
  const fromIst = istDateStringFromUtc(weekMondayUtc);
  const toIst = istDayOffset(fromIst, 6);
  return {
    fromUtc: utcDateForIstDay(fromIst),
    toUtc: new Date(utcDateForIstDay(toIst).getTime() + 86_399_999),
    fromIst,
    toIst,
  };
}

/** `Date` representing the current instant — injectable for tests. */
export function nowUtc(): Date {
  return new Date();
}
