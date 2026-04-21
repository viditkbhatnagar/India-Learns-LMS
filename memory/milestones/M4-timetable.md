# M4 — Timetable

**Date completed:** 2026-04-21
**Supersedes:** — (extends M3 course + enrolment core)
**Test result:** 35 files / 166 tests green · services coverage 81.3% lines / 93.16% functions / 64.15% branches (gates 70/70/55 — all pass).

## What was built

Server-only Timetable surface + minimal NotificationService. 6 new routes,
4 new collections, 6 new services, 9 new audit actions.

- **Models** (all `mongoose.models.X ?? model(...)` per D-018):
  - `TimetableEntry` — `{ batchId, courseId, facultyId, dayOfWeek (0..6), startTimeMinutes, endTimeMinutes, room, notes, deletedAt }`. IST wall-clock minutes, no Date stored. See [api/src/models/timetableEntry.ts](../../api/src/models/timetableEntry.ts).
  - `TimetableOverride` — TRD §4.5 extended with `action: 'cancel' | 'reschedule' | 'add'` (Q-M4-01). Partial-unique on `{batchId, entryId, date}` filtered to `entryId != null` so add-overrides (entryId null) don't dedup. See [api/src/models/timetableOverride.ts](../../api/src/models/timetableOverride.ts).
  - `Holiday` — `{ date, name, kind: 'public' | 'institutional' }` with unique `{date}`. See [api/src/models/holiday.ts](../../api/src/models/holiday.ts).
  - `Notification` — `{ userId, type: 'timetable.change', title, body, data, channels: ['inapp'|'email'], readAt, emailSentAt, emailError }`. In-app persistence; M8 replaces with full template registry. See [api/src/models/notification.ts](../../api/src/models/notification.ts).

- **Services**:
  - `timetableTz` ([api/src/services/timetableTz.ts](../../api/src/services/timetableTz.ts)) — IST helpers via `date-fns-tz` (finally installed — D-040). Key functions: `istDateStringFromUtc`, `utcDateForIstDay`, `istWallClockIso` (returns `YYYY-MM-DDTHH:MM:00+05:30`), `istDayOfWeek`, `istDayRange`, `parseIsoWeek('2026-W28')`. India has no DST so offset is a constant +05:30.
  - `timetableEntryService` — CRUD with `assertNoOverlap` (same-batch-OR-same-faculty-OR-same-room on same day with intersecting `[start,end)` ranges → 409 `TIMETABLE_OVERLAP`). Faculty validated against `Course.facultyIds` (reuses D-024's `facultyAssignedToCourse`).
  - `holidayService` — CRUD + `listHolidaysByIstDates` helper used by the resolver. Unique-by-date guarded at both service-level pre-check and MongoDB 11000 mapper (D-041 adds `HOLIDAY_DUPLICATE`).
  - `timetableOverrideService` — CRUD + per-action validation (`validateCancel`, `validateReschedule`, `validateAdd`). Every mutation triggers `notifyTimetableChange`. Action is immutable on update (delete-and-recreate if you need a different action).
  - `timetableResolutionService.resolveWindow({batchId, from, to})` — the core. (1) load entries, overrides, holidays for the batch & window; (2) for each IST day: skip if holiday; walk entries matching `dayOfWeek`, apply cancel/reschedule overrides; (3) emit `add` overrides as synthetic occurrences with `entryId: null`; (4) sort by `startAt`. Hydrates `courseName`/`facultyName` in two batched `$in` queries to avoid N+1.
  - `timetableResolutionService.getNextClassForStudent(studentId, now = nowUtc())` — student → active enrolments → batchIds (multi-batch tolerant) → `resolveWindow` for [now, +14d] → first occurrence ≥ now in IST wall-clock lex compare. Returns null when nothing upcoming.
  - `notificationService` — `enqueueNotification({type, recipients, title, body, data, channels?})` writes one `Notification` doc per recipient (in-app) and best-effort dispatches via `getIntegrations().email.send(...)`. `typeToChannels('timetable.change') = ['inapp', 'email']` — WhatsApp explicitly excluded (D-037). `notifyTimetableChange(payload)` fans out to active students in the batch ∪ original faculty ∪ new faculty.

- **Dashboard**: [api/src/services/studentDashboardService.ts](../../api/src/services/studentDashboardService.ts) now calls `getNextClassForStudent` in parallel with `listEnrollmentsForStudent`. `nextClass` shape changed from `{stub: true, value: null}` to `{stub: false, value: TimetableOccurrenceDto | null}`. M5–M7 stub envelope for the other buckets preserved verbatim.

- **Routes** (all `requireAuth`):
  - `POST/GET /v1/batches/:id/timetable` — entry list (admin/superadmin full; faculty auto-scoped to own). `POST` admin-only.
  - `GET/PATCH/DELETE /v1/timetable/:entryId`.
  - `POST/PATCH/DELETE /v1/timetable/overrides[/:id]` (admin).
  - `GET /v1/timetable?batchId=&from=&to=` — resolved occurrences. Students limited to own active-enrolment batch (HTTP 403 otherwise). Window guardrail: ≤ 90 days.
  - `GET /v1/me/timetable?week=YYYY-Www | from=&to=` — student/faculty. Faculty auto-filters to `facultyId === self`.
  - `GET /v1/holidays?from=&to=`, `POST /v1/holidays`, `DELETE /v1/holidays/:id`.
  - `GET /v1/notifications/me?unreadOnly=&limit=` + `POST /v1/notifications/:id/read`.

- **Shared types** ([packages/shared-types/src/](../../packages/shared-types/src/)): new `OVERRIDE_ACTIONS`, `HOLIDAY_KINDS`, `NOTIFICATION_TYPES`, `NOTIFICATION_CHANNELS` enums; 8 new `AUDIT_ACTIONS` verbs. New `dto/timetable.ts` (`TimetableEntryDto`, `TimetableOverrideDto`, `HolidayDto`, `TimetableOccurrenceDto`, Create/Update inputs) + `dto/notification.ts`.

- **Error middleware**: [api/src/middleware/error.ts](../../api/src/middleware/error.ts) 11000-duplicate mapper extended to handle `{date}` (→ `HOLIDAY_DUPLICATE`) and `{batchId, entryId, date}` (→ `OVERRIDE_DUPLICATE`). New domain codes thrown by services: `TIMETABLE_OVERLAP`, `INVALID_TIME_RANGE`, `INVALID_DATE_WINDOW`.

- **Seed script** ([api/scripts/seed.ts](../../api/scripts/seed.ts)) — idempotently seeds one faculty + one published course (`airport-ground-ops`) + one batch (`Aviation Batch 1 — July 2026`) + two entries (Mon/Wed 18:00–20:00 IST) + one reschedule override (Wed 8 Jul → 19:00–21:00) + one holiday (15 Aug 2026). Makes the DoD curl runnable out of the box (D-042).

- **Tests** (11 new files added · 44 new tests):
  - Unit: `timetableTz.test.ts` (7), `timetableResolutionService.test.ts` (7), `notificationService.test.ts` (4), `timetableEntryService.test.ts` (4).
  - Integration: `timetableEntries.crud.test.ts` (5), `timetableOverrides.test.ts` (6), `holidays.test.ts` (3), `timetable.resolve.test.ts` (4), `meTimetable.test.ts` (3), `notifications.me.test.ts` (2).
  - Extended: `studentDashboard.test.ts` (3, was 2; new `nextClass` populated case).

## API surface mounted

`/v1/batches/:id/timetable` · `/v1/timetable/:entryId` · `/v1/timetable/overrides[/:id]` · `/v1/timetable?batchId=&from=&to=` · `/v1/me/timetable?week=YYYY-Www | from=&to=` · `/v1/holidays` · `/v1/notifications/me`, `/v1/notifications/:id/read`.

All success responses `{data: ...}`; errors `{error: {code, message, details?}}`.

## Tests (166 / 166 green)

Full-suite services coverage 81.3% lines / 93.16% functions / 64.15% branches — passes the 70/70/55 gate in [api/vitest.config.ts](../../api/vitest.config.ts). Notable per-file:

- `timetableResolutionService` — the headline logic, covers all 4 action shapes + holiday drop + next-class.
- `notificationService` — 96.77% lines; WhatsApp-excluded channel map asserted.
- `timetableTz` — 93.81% lines; IST ISO formatting + DST-safe day arithmetic.

## Files changed / added

**New (models)**: `api/src/models/{timetableEntry, timetableOverride, holiday, notification}.ts`.
**New (services)**: `api/src/services/{timetableTz, timetableEntryService, timetableOverrideService, timetableResolutionService, holidayService, notificationService}.ts`.
**New (routes)**: `api/src/routes/{timetableEntries, timetableOverrides, timetable, meTimetable, holidays, notifications}.ts`.
**New (shared-types)**: `packages/shared-types/src/dto/{timetable, notification}.ts`.
**New (tests)**: 10 files under `api/tests/` (see list above).
**New (docs)**: [docs/smoke/m4-timetable.md](../../docs/smoke/m4-timetable.md).

**Modified**:
- `api/src/models/index.ts` — re-export 4 new models.
- `api/src/routes/index.ts` — mount 6 new routers.
- `api/src/services/studentDashboardService.ts` — `nextClass` now calls real helper.
- `api/src/middleware/error.ts` — two new 11000-duplicate mappings.
- `api/scripts/seed.ts` — idempotent M4 sample data.
- `api/package.json` — added `date-fns@^3.6.0`, `date-fns-tz@^3.2.0`.
- `packages/shared-types/src/enums.ts` — +4 enums + 8 audit actions.
- `packages/shared-types/src/index.ts` — re-export new dtos.
- `packages/shared-types/src/dto/course.ts` — `StudentDashboardDto.nextClass` widened to `{stub: boolean; value: TimetableOccurrenceDto | null}`.
- `api/tests/helpers/factories.ts` — `makeTimetableEntry`, `makeTimetableOverride`, `makeHoliday`, `makeNotification`.
- `api/tests/integration/studentDashboard.test.ts` — updated for new `nextClass` shape.

## Example curl flow (DoD smoke)

See [docs/smoke/m4-timetable.md](../../docs/smoke/m4-timetable.md) for the full flow. Headline:

```bash
# Seed
MONGODB_URI=… npm run seed -w api

# Resolve Aviation batch for next 14 days
curl -sS "http://localhost:4000/v1/timetable?batchId=$BATCH&from=2026-07-06&to=2026-07-19" \
  -H "authorization: Bearer $AT" | jq '.data.occurrences[].startAt'
# → "2026-07-06T18:00:00+05:30"
# → "2026-07-08T19:00:00+05:30"   ← rescheduled
# → "2026-07-13T18:00:00+05:30"
# → "2026-07-15T18:00:00+05:30"
```

## Open items / known gaps for later milestones

- **Q-M4-01**: TRD §4.5 only allows `cancel | reschedule`; M4 prompt demanded `add`. Shipped additively with `entryId: null`; needs Logan ratification before M9.
- **Q-M4-02**: Faculty `/v1/me/timetable` filters by `facultyId === self`; matches PRD US-TT-04 but isn't spec-pinned.
- **Q-M4-03**: `Notification` collection has no retention policy — will grow unbounded. M9 runbook addendum needed.
- **Q-M4-04**: Overlap detection rejects same-room overlaps across ALL batches (room = physical resource). Confirm with Logan.
- **Q-M4-05**: Notification template copy is hardcoded; M8 template registry is the permanent home.

## For the next session (M5 — Fees + suspension)

- **`Enrollment.accessState`** (D-026): the fee-suspension state machine lives here; `moduleAccessService` already gates on it. M5 needs to flip it (`active → warn1 → warn2 → suspended`) based on installment due dates.
- **Notifications for fees**: M5 adds `fees.due`, `fees.paid`, `fees.warning.1`, `fees.warning.2`, `fees.suspended` notification types. WhatsApp IS wired for `fees.due` and `fees.paid` per BRD §6.1 — flip `typeToChannels` to include `'whatsapp'` for those types specifically.
- **Receipt PDF**: TRD §9 uses `pdfkit`; `CloudinaryStorageAdapter` is scheduled for first real wiring here.
- **StudentDashboard.outstandingFees**: replace stub with real aggregate (currently `{stub: true, totalPaise: 0}`).
- **Counters**: re-use [api/src/services/counterService.ts](../../api/src/services/counterService.ts) for `Invoice`, `Receipt`, `CreditNote` code sequences (pattern already used for User IL-YYYY-NNNN codes).
- **Audit** action namespace: `fees.invoice.*`, `fees.installment.*`, `fees.payment.*`, `fees.receipt.*`.

## Surprises during M4

1. **`sparse: true` vs partial-filter for override dedup** — `TimetableOverride` dedup needs to exclude `entryId: null` (add-overrides). `sparse` skips missing fields but not explicit nulls (D-034 lesson from M3). Used `partialFilterExpression: { entryId: { $type: 'objectId' } }` which correctly indexes only non-null `entryId` rows.
2. **Holiday day-key recovery** — `Holiday.date` stores UTC midnight of the IST day (e.g. `2026-08-14T18:30:00Z` for 15 Aug IST). Recovering the IST YMD for map-keying requires `+330 minutes` offset before slicing — doing it on the UTC `toISOString` would produce the wrong day.
3. **`nextClass` envelope type widen** — `StudentDashboardDto.nextClass` was typed `{ stub: true; value: null }` (hard-coded literal `true`). Widened to `{ stub: boolean; value: TimetableOccurrenceDto | null }` so the dashboard can return the real occurrence. M3 integration test needed updating.
4. **Faculty-scope filter on `/v1/batches/:id/timetable`** — service returns all batch entries; route filters by `facultyId === self` for faculty tokens. Keeps the service pure and lets admin reuse the same endpoint.
5. **ISO week parsing** — Hand-rolled (not via `date-fns`) because `date-fns` parseISO refuses `YYYY-Www` without a day component. The ISO-week → Monday algorithm uses Jan 4 as the week-1 Thursday anchor, which is timezone-agnostic.
