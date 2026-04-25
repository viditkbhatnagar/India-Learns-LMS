# Open questions — curriculum import + Phase B

Status legend:
- **DEFAULT**: shipped behavior, override-able by Logan / product later.
- **TODO**: blocked on external answer.

Maintained alongside the PR work. Update when an answer lands or a default is overridden.

---

## Phase B-1 (gradebook + two-step publish)

### Late submission policy
**DEFAULT**: shipped 2026-04-25. A submission is flagged `lateFlag=true` if `submittedAt > assignment.dueAt`. No automatic score deduction; faculty can apply judgment. The flag surfaces as a "Late" pill on the per-assignment grading view and gradebook cell.
- Reason: predictable behavior, no hidden math. Logan can override later.
- Override path: add `lateScoreCapPercent` field on `Assignment` and apply during draft → publish.

### Grade visibility timing
**DEFAULT**: shipped 2026-04-25. Publish is immediate — student sees the grade the moment faculty hits Publish. No scheduled / batch release window.
- Reason: simplicity; faculty can save drafts as long as they want before publishing, which already gives them a "release later" mechanism.
- Override path: add `scheduledReleaseAt` on the Submission and a cron that flips drafts → published when due.

### Co-teaching: who can publish?
**DEFAULT**: shipped 2026-04-25. Any faculty in the course's `facultyIds` array can publish. Audit log records `publishedByUserId`. No quorum, no second-faculty review.
- Reason: simplest viable. Two-faculty courses are uncommon in Phase 1.
- Override path: add `requireSecondPublisher: true` flag on `Course`, gate publish on a separate "approval" step.

### Re-submission after grade publish
**DEFAULT**: shipped 2026-04-25. A student can re-submit an assignment after their grade was published. Re-submission resets:
- `status` → `submitted`
- `score`, `feedback`, `rubricScores` → null
- `gradedByUserId`, `gradedAt`, `publishedAt`, `publishedByUserId` → null
- The previous grade is preserved in audit-log `before` payload only — not in the submission row.
- The faculty must regrade and republish. Notification is sent so they know.

### Bulk publish — partial failures
**DEFAULT**: shipped 2026-04-25. If bulk publish hits N drafts and one fails (e.g. invalid score, drift), the loop short-circuits — already-published rows stay published, the failure surfaces with the offending submission id, untouched rows stay drafts. No rollback. The UI shows "Published X of N; failed on Y".

---

## Curriculum-generator integration (Phase A residual)

### `undefined-<variant>` assignmentId fallback
**DONE on generator side** as of 2026-04-25 (Vidit confirmed). LMS keeps the
`${moduleCode}-${variant}` fallback for workflows already in Mongo — new
generations won't hit the path.

---

## Phase B-2 (Course→Module→Session tree)

### Attendance threshold for course completion
**DEFAULT**: shipped 2026-04-25. Attendance is recorded but not enforced
downstream. The handoff PDF §12 suggests 80% as an institutional default,
but until Logan signs off we don't gate certificate issuance, fee status,
or any other workflow on attendance %.
- Override path: add `Course.minAttendancePercent` (default 80) and gate the
  certificate issuance flow on `actualAttendancePercent >= minAttendancePercent`.

### Co-teaching conflict resolution
**DEFAULT**: shipped 2026-04-25. Last-write-wins on session edits and
attendance. If two faculty mark attendance on the same session
simultaneously, the second upsert overwrites the first per
(sessionId, studentId). Audit log records who.
- Reason: in Phase 1, multi-faculty courses are uncommon. Real-time
  conflict UX adds significant complexity for marginal value.
- Override path: add an `If-Match` ETag pattern on Session.updatedAt and
  AttendanceRecord.markedAt. Reject mutations with stale tokens.

### Session rescheduling vs timetable override
**DEFAULT**: shipped 2026-04-25. The Session entity stores
`scheduledStart`/`scheduledEnd` for the canonical session date/time. The
existing TimetableOverride collection stays the source of truth for
recurring-schedule deviations. If faculty needs to move a single session,
they edit `scheduledStart`/`scheduledEnd` directly on the session — that
write does NOT auto-create a TimetableOverride. The two systems are
parallel sources of truth in B-2; reconciling them is Phase B-3.
- Override path: when ready, mirror Session schedule edits into
  TimetableOverride and treat one as authoritative.

### Students tab depth
**DEFAULT**: stub in B-2. The Students tab renders a placeholder card
("Roster + per-student grades + attendance summary — coming soon"). No
data fetched, no API surface added.
- Override path: when speccing the deeper Students tab, decide whether
  it needs cross-course views or stays course-scoped.

### Auto-generated session locking
**DEFAULT**: shipped 2026-04-25. The synthesized "Assessment" sessions
(per-module, holding step12 assignment-pack variants) and the "Final Exam"
session (course-level, holding step13) are surfaced as
`isAutoGenerated: true` in the DTO. UI restricts:
- title is read-only
- DnD reorder is blocked (lock chip in the drag handle)
- description is editable (faculty notes welcome)
- attendance + completion work normally

This is the "engineering call I flagged when B-1 shipped" the user noted —
auto-gen sessions exist alongside real lessons and need to feel different
without losing core functionality.
