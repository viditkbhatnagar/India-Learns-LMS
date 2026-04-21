import { Holiday } from '../models/index.js';
import { istDateStringFromUtc, istDayOfWeek } from './timetableTz.js';

// PRD §10.4: Complaint SLA is "15 business days (Mon–Fri, excluding public
// holidays)". Holiday rows are stored as IST-midnight UTC per D-038; here we
// key them by IST-YMD so comparisons line up with what the admin entered.

export interface HolidaySet {
  // Set of IST-YMD strings (e.g. '2026-08-15').
  readonly days: Set<string>;
}

export function isBusinessDay(d: Date, holidays: HolidaySet): boolean {
  const dow = istDayOfWeek(d); // 0 = Sunday IST, 6 = Saturday IST
  if (dow === 0 || dow === 6) return false;
  return !holidays.days.has(istDateStringFromUtc(d));
}

/**
 * Fetch all Holidays whose IST date falls in `[fromIstYmd, toIstYmd]` (inclusive)
 * and return them as a Set of IST-YMD strings for O(1) lookup.
 * Callers should pass a window slightly wider than the SLA horizon they need
 * so `addBusinessDays` can't "walk off" the end.
 */
export async function loadHolidaySet(fromIst: Date, toIst: Date): Promise<HolidaySet> {
  const docs = await Holiday.find({
    date: { $gte: fromIst, $lte: toIst },
  }).select('date');
  const days = new Set<string>();
  docs.forEach((doc) => days.add(istDateStringFromUtc(doc.date)));
  return { days };
}

const DAY_MS = 86_400_000;

/**
 * Add `n` business days to `start`. `start` itself is never counted — the
 * result is always strictly in the future. Deterministic given the same
 * `HolidaySet`, so tests can assert exact deadlines.
 * Throws if `n < 0` or if the walk exceeds 400 iterations (runaway safety).
 */
export function addBusinessDays(
  start: Date,
  n: number,
  holidays: HolidaySet,
): Date {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error(`addBusinessDays: n must be a non-negative integer, got ${n}`);
  }
  if (n === 0) return new Date(start.getTime());
  let cursor = new Date(start.getTime());
  let added = 0;
  let iterations = 0;
  while (added < n) {
    iterations += 1;
    if (iterations > 400) {
      throw new Error('addBusinessDays: iteration cap exceeded');
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isBusinessDay(cursor, holidays)) {
      added += 1;
    }
  }
  return cursor;
}

/**
 * Convenience wrapper for ticket SLA. Loads holidays covering `[start, start+45d]`
 * (buffer past the 15bd complaint deadline) and returns the deadline.
 */
export async function addBusinessDaysWithLoad(
  start: Date,
  n: number,
): Promise<Date> {
  const from = new Date(start.getTime() - DAY_MS);
  const to = new Date(start.getTime() + (n + 30) * DAY_MS);
  const holidays = await loadHolidaySet(from, to);
  return addBusinessDays(start, n, holidays);
}
