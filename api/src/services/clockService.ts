// Central time source. Production code must call `nowUtc()` instead of
// `new Date()` so tests can time-travel deterministically via `setTestNow`.
// Introduced in M5 for the fee-reminder cron and auto-suspension state machine;
// backfill opportunities in earlier services are non-blocking (D-047).

let testNowOverride: Date | null = null;

export function nowUtc(): Date {
  return testNowOverride ? new Date(testNowOverride.getTime()) : new Date();
}

/** Test-only. Pass `null` (or call `resetClock`) to return to wall-clock time. */
export function setTestNow(date: Date | null): void {
  testNowOverride = date ? new Date(date.getTime()) : null;
}

export function resetClock(): void {
  testNowOverride = null;
}

export function advanceTestNow(ms: number): void {
  if (!testNowOverride) {
    throw new Error('advanceTestNow requires setTestNow to have been called first.');
  }
  testNowOverride = new Date(testNowOverride.getTime() + ms);
}
