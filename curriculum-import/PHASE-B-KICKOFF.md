# Phase B kickoff — paste into the India Learns LMS Claude Code chat

Phase A is in. PR #1 merged, sample workflow round-trips. Move to Phase B.

**Sequence:** gradebook-first, then the Course→Module→Session tree. Reasoning: the gradebook validates the imported data model under real read patterns, has a smaller blast radius than rewriting the navigation spine, and pulls forward the highest-pain workflow for faculty so we get usage signal while the tree is in flight. The tree comes second.

---

## Phase B-1 — Gradebook + two-step publish

Spec source: developer handoff PDF §7.5 (Gradebook grid + per-assignment view) and §8.2 (two-step grading, attendance-gated).

### What to build

1. **`Submission` model.** Generator doesn't produce these — students do. Fields per §4 of the handoff PDF, plus a `status` state machine:
   - `not_started` → `in_progress` → `submitted` → `needs_grading` → `graded_draft` → `published`
   - `missing` is computed (status=`not_started` AND past due date), not stored.
   - `gradedDraft` payload (rubric scores + feedback + numeric grade) is faculty-only-visible until `published` flips. That's the two-step publish.
   - Index on `(assignmentId, studentId)` unique, plus `(courseId, status)` for the gradebook grid.

2. **Gradebook grid** — `/courses/:id/gradebook`:
   - Rows = students enrolled in the course (existing `Enrollment` collection).
   - Columns = assignments in the course (the imported `Assignment` rows from Phase A — including the synthesized "Assessment" sessions and the Final Exam).
   - Each cell shows the latest `Submission.status` + grade if published, or a draft chip if `graded_draft` (faculty-only).
   - Sortable by student name and by assignment due date.
   - Single source of truth for "grading backlog": `Submission.status === 'needs_grading'`. Surface the count at the top.

3. **Per-assignment view** — `/courses/:id/assignments/:assignmentId/grading`:
   - Three filter chips: `needs_grading` | `missing` | `graded`.
   - Submission list with rubric (the imported `Assignment.rubric`) inline, score inputs per criterion, free-text feedback box.
   - "Save draft" → status=`graded_draft` (faculty sees, student doesn't).
   - "Publish" → status=`published`, sends notification to student. Confirm dialog before publish.
   - Bulk actions: select N submissions, publish drafts together.

4. **Permissions / role gating:**
   - Faculty sees only their own courses' submissions. SuperAdmin sees all but with the oversight banner from the handoff PDF §10.
   - Student sees `published` submissions only — never drafts. This is non-negotiable; assert at the API layer, not just the UI.
   - Audit log entry for every publish (actor, submission id, before/after status, at) — write to existing `audit_logs`.

5. **Empty / loading / error states** per §10:
   - Empty gradebook (course with 0 assignments yet) → CTA to "Run curriculum import" pointing at the Phase A flow.
   - Loading skeletons >200ms.
   - Permission-variant: SuperAdmin viewing a course they don't teach gets the oversight banner above the gradebook.

### What's out of scope for B-1

Attendance, weighted rubric math, late-submission policy enforcement, plagiarism, peer review, parent portals, mobile-native. All on the §11 deferred list. We surface raw scores in B-1; weighted-grade computation comes later.

### Open questions you'll need to resolve before publish-flow ships

These are §12 of the handoff PDF — Logan/staff input needed:
- Late submission policy (cap at submitted-after-due as `late=true` flag for now; no auto-deduction).
- Grade visibility timing — confirm publish is immediate (no scheduled release window in B-1).
- Co-teaching: if two faculty share a course, can both publish? Default: yes, both have full grading rights, audit log records who.

Don't block on these — pick the conservative default and flag in `OPEN-QUESTIONS.md` for Logan.

### Build sequence

1. `Submission` model + migration.
2. `POST /api/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/draft` — save draft (faculty only).
3. `POST /api/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/publish` — publish (faculty only, transitions status, fires notification, audit-logs).
4. `GET /api/courses/:courseId/gradebook` — paginated grid endpoint, returns rows×columns shape.
5. Gradebook grid UI + per-assignment grading UI.
6. Tests: integration coverage on the role-gating (student MUST NOT see drafts, SuperAdmin sees with banner), unit coverage on the state machine.

### Done when

- Faculty can grade an assignment, save a draft, see it themselves, edit, publish, and the student sees the grade only after publish.
- Gradebook backlog count matches `count(submissions where status='needs_grading')`.
- Bulk publish works on >1 selected drafts.
- Audit log has one entry per publish.
- Lighthouse on the gradebook page ≥ 90.
- Playwright E2E covers the draft → edit → publish round trip.

---

## Phase B-2 — Course → Module → Session tree (after B-1 lands)

Spec source: handoff PDF §3 (routes), §7 (Content tab with collapsible Module → Session tree, `@dnd-kit/core` reordering), §8 (session completion explicit, attendance-gated, undoable for 7 days).

Don't start until B-1 is in production and stable for at least 48 hours. The data model you imported in Phase A is already shaped for this — sessions exist, materials hang off them, assignments reference sessions. B-2 is mostly UI + the explicit-completion state machine.

I'll write the B-2 prompt when you ping me after B-1.

---

## Generator-side note

The `undefined-<variant>` bug we worked around in Phase A is fixed at the source on the CurriculumGenerator side (commits in flight). Your fallback `${moduleCode}-${variant}` stays in for backward compat with workflows already in Mongo, but new generations won't hit it.

---

## Action

Read this file → spec out the `Submission` model + state machine → write migrations → wire the two endpoints → build the gradebook grid first, per-assignment view second → ship behind super-admin + faculty roles. Open a PR when the draft → publish round trip works end-to-end against the imported assignments from workflow `69bbf3cd5c4093e441e75eba`.

Track open questions for Logan in `curriculum-import/OPEN-QUESTIONS.md`.
