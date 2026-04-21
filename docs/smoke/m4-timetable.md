# Smoke — M4 Timetable

Last run: 2026-04-21.

Exercises the M4 surface end-to-end against a live MongoDB Atlas instance
seeded by `npm run seed -w api`. No web client — this is a backend-only
milestone.

## Prereqs

- API running on `:4000` (`npm run dev -w api`).
- `MONGODB_URI` pointing at an empty/dev database.
- M2 super-admin seeded (`npm run seed:superadmin -w api`) with
  `admin@luc.local` / `Admin#12345`.
- `npm run seed -w api` — seeds:
  - 2 programs (Aviation, Retail & Fashion)
  - 1 faculty user + 1 published course (`airport-ground-ops`)
  - 1 batch (`Aviation Batch 1 — July 2026`)
  - 2 timetable entries (Mon + Wed 18:00–20:00 IST)
  - 1 reschedule override on Wed 8 Jul 2026 → 19:00–21:00
  - 1 holiday on 15 Aug 2026 (Independence Day)

## 1. Admin login

```bash
export AT=$(curl -sS -c cookies.txt -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@luc.local","password":"Admin#12345","deviceId":"dev-1"}' \
  | jq -r .data.accessToken)
```

## 2. Resolve timetable for the seeded Aviation batch (14 days)

```bash
export BATCH=$(curl -sS "http://localhost:4000/v1/batches" -H "authorization: Bearer $AT" \
  | jq -r '.data.items[] | select(.name=="Aviation Batch 1 — July 2026") | .id')

curl -sS "http://localhost:4000/v1/timetable?batchId=$BATCH&from=2026-07-06&to=2026-07-19" \
  -H "authorization: Bearer $AT" | jq
```

Expected shape:

```json
{
  "data": {
    "occurrences": [
      {
        "entryId": "…",
        "overrideId": null,
        "batchId": "…",
        "courseId": "…",
        "courseName": "Airport Ground Ops",
        "facultyId": "…",
        "facultyName": "Seed Faculty One",
        "date": "2026-07-06",
        "startAt": "2026-07-06T18:00:00+05:30",
        "endAt":   "2026-07-06T20:00:00+05:30",
        "room": "Room 1",
        "notes": "Seeded M4 sample session.",
        "isOverride": false,
        "isAdded": false
      },
      {
        "entryId": "…",
        "overrideId": "…",
        "date": "2026-07-08",
        "startAt": "2026-07-08T19:00:00+05:30",
        "endAt":   "2026-07-08T21:00:00+05:30",
        "isOverride": true
      },
      { "date": "2026-07-13", "startAt": "2026-07-13T18:00:00+05:30", "isOverride": false },
      { "date": "2026-07-15", "startAt": "2026-07-15T18:00:00+05:30", "isOverride": false }
    ]
  }
}
```

Note the literal `+05:30` suffix on every `startAt`/`endAt`.

## 3. Verify holiday hides 15 Aug

```bash
curl -sS "http://localhost:4000/v1/timetable?batchId=$BATCH&from=2026-08-10&to=2026-08-22" \
  -H "authorization: Bearer $AT" | jq '.data.occurrences[].date'
```

`"2026-08-15"` is **absent** even though Saturday 15 Aug has no entry — the
holiday is applied regardless of whether a recurring slot would have fired.

## 4. Create a new override (cancel)

```bash
export ENTRY=$(curl -sS "http://localhost:4000/v1/batches/$BATCH/timetable" \
  -H "authorization: Bearer $AT" \
  | jq -r '.data.entries[] | select(.dayOfWeek==1) | .id')

curl -sS -X POST http://localhost:4000/v1/timetable/overrides \
  -H "authorization: Bearer $AT" -H 'content-type: application/json' \
  -d "{\"batchId\":\"$BATCH\",\"entryId\":\"$ENTRY\",\"date\":\"2026-07-13\",\"action\":\"cancel\",\"reason\":\"Faculty unwell\"}" | jq
```

Expected: 201 with `action: "cancel"`. A `Notification` doc is written
per recipient (student + faculty) and an email is dispatched via the
configured `EmailAdapter`.

## 5. Student view their week

Log in as the student (create one via `POST /v1/users` as admin, accept the
invite via `/v1/auth/invite/accept`, then `POST /v1/auth/login`):

```bash
curl -sS "http://localhost:4000/v1/me/timetable?week=2026-W28" \
  -H "authorization: Bearer $STU_AT" | jq
```

Returns `{ data: { window: {from,to}, occurrences: [...] } }` for the week
starting Mon 6 Jul 2026.

## 6. Student dashboard — nextClass populated

```bash
curl -sS http://localhost:4000/v1/students/me/dashboard \
  -H "authorization: Bearer $STU_AT" | jq '.data.nextClass'
```

Expected:

```json
{
  "stub": false,
  "value": {
    "date": "2026-…-…",
    "startAt": "2026-…-…T18:00:00+05:30",
    "courseName": "Airport Ground Ops",
    "facultyName": "Seed Faculty One"
  }
}
```

## 7. List own notifications + mark one read

```bash
curl -sS http://localhost:4000/v1/notifications/me \
  -H "authorization: Bearer $STU_AT" | jq '.data.items[0].id'

curl -sS -X POST "http://localhost:4000/v1/notifications/$NID/read" \
  -H "authorization: Bearer $STU_AT" | jq '.data.notification.readAt'
```

## Tests

`npm test -w api` → **35 files / 166 tests green**.
`npm run test:coverage -w api` → `services/**` 81.3% lines / 64.15% branches
/ 93.16% functions (gates: 70/55/70 — pass).
