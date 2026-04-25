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

## Phase B-2 (Course→Module→Session tree) — not yet started

Defer until B-1 is in production for 48h.
