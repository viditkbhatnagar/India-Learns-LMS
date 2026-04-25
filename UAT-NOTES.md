# UAT Notes

The smallest test that surfaces what the unit tests can't catch — a real
faculty member spending 30 minutes in the course shell. Capture findings
here so they don't get lost between sessions.

> **Tone for findings**: be specific. "Confusing" isn't actionable; "the
> Publish button on the gradebook drawer is below the fold on a 13" laptop
> at 100% zoom" is.

---

## Live UAT environment

- **URL**: https://india-learns-lms.onrender.com
- **DB**: `india_learns_staging` on the `dev.gdddmth.mongodb.net` Atlas cluster
- **Faculty seed**: `faculty-seed-1@luc.local` / `Faculty#12345` — assigned to
  both `Airport Ground Ops` (no sessions) and `Maths Certification`
  (107 imported sessions, 25 assignments, 98 slide decks).
- **Super admin**: `superadmin@indialearns.test` / `Superadmin#2026`
- **UAT students** (seeded 2026-04-25 via `api/scripts/seed-uat-students.ts`):
  - `uat-student-1@luc.local` / `Uat#student-2026`
  - `uat-student-2@luc.local` / `Uat#student-2026`
  - `uat-student-3@luc.local` / `Uat#student-2026`

  All three are enrolled in the Aviation Diploma program → so they show up
  in both Airport AND Maths Certification gradebooks.

---

## 30-minute UAT script (faculty)

Hand this to whoever's running the test session. Time the steps; flag
anything that takes longer than the time-box or feels off.

| Time | Step | What success looks like |
|---|---|---|
| 0:00 | Sign in as faculty (`faculty-seed-1@luc.local`). | Lands on `/faculty/dashboard`. |
| 1:00 | Click "My Courses" → "Maths Certification". | Lands on `/courses/:id/overview`. Sees 8-module course tree counts (modules / sessions / assignments / grading-backlog metric cards). |
| 3:00 | Click "Content". | Module accordion. Drag a session within a module to a new slot — does it re-number cleanly? Drag across modules — does the source module compact? Drag an "Auto-generated" session — does the drag handle stay disabled? |
| 8:00 | Click into one session (any non-auto-generated). | 2/3 + 1/3 layout: description, materials, assignments left; attendance + private notes right. Mark-complete is disabled with the tooltip "Take attendance for at least one student before marking the session complete." |
| 10:00 | Take attendance: toggle one student to absent, one to late, the rest stay present. Click "Save attendance". | Saved confirmation. Re-load the page — values stick. |
| 13:00 | Click "Mark complete". | Status flips to `completed`. The button changes to "Undo complete" with a tooltip showing the 7-day window. Audit log records `session.completed`. |
| 15:00 | Open the Gradebook tab. | Grid renders. The seeded UAT students show as rows. Cells for the un-graded assignments show "To grade" / "Missing" pills. |
| 18:00 | Open per-assignment grading on any imported assignment. | Filter chips work. Pick a "needs_grading" submission (or seed one if needed). Save a draft → "Draft" pill appears. Try the publish-confirm dialog. |
| 25:00 | Sign out. Sign in as `uat-student-1`. Navigate to the gradable assignment. | Student sees their submission status as "submitted" — never sees the draft score / feedback. |
| 27:00 | Sign in as faculty again. Publish the draft. Sign in as student. | Now the student sees the published score. |

---

## Findings template

Append a row per finding. Don't edit prior rows.

```
### YYYY-MM-DD HH:MM — <name>, <role>

- Where: <URL or screen>
- What: <what they saw>
- Expected: <what they expected>
- Severity: blocker / annoying / cosmetic / suggestion
- Reproducer: <steps>
- Screenshot: <link or attached>
```

---

## Findings

(empty — first UAT session populates this)

---

## When to graduate from UAT to "ship next phase"

Phase B is end-to-end complete. Don't start B-3 (or any new phase) until:

1. At least one full 30-minute UAT session has been run with a real
   faculty member.
2. Findings of severity `blocker` or `annoying` have either been resolved
   on a tactical follow-up branch or explicitly deferred with a reason.
3. The seed script (`api/scripts/seed-uat-students.ts`) has been re-run
   after any schema changes that affect student enrolment shape.

Synthetic forward motion ahead of UAT signal is risk accumulation against
a spec that may itself be wrong somewhere — wait for the input.

---

## Re-seeding UAT staging

If the demo data on `india_learns_staging` is wiped or rebuilt, re-run:

```bash
MONGODB_URI="mongodb+srv://<user>:<pass>@dev.gdddmth.mongodb.net/india_learns_staging?retryWrites=true&w=majority&appName=dev" \
  npx tsx api/scripts/seed-uat-students.ts
```

The script is idempotent — re-running keeps existing UAT users, re-sets
their password, and skips enrolment if it already exists. Audit-logs every
write with `details.source: 'seed-uat-students'`.

Pre-conditions:
- The Maths Certification course (`sourceWorkflowId: 69bbf3cd5c4093e441e75eba`)
  must be imported. If absent, run the curriculum import as superadmin
  first via `/admin/curriculum-import` in the web UI, or:
  `tsx api/scripts/test-curriculum-import.ts 69bbf3cd5c4093e441e75eba`.
- The course's program must have at least one batch (the seed script
  auto-creates one if none is present).
