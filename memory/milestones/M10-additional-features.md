# M10 — Additional features from May 2026 requirements docs

**Inputs:**
- `LMS_Requirements.docx` — academic profile, internal chat, placement, payments, attendance
- `LMS_Faculty_Features_Requirements_.docx` — attendance, assignments, courseware, reports, faculty dashboard

**Scope decisions (2026-05-20, Vidit + Logan via AskUserQuestion):**

| Theme | Decision |
|---|---|
| Timing | Ship Phase 1 + 2 together — "all now, commit by commit, then test on production" |
| Online payment gateway | **OUT of scope.** Keep manual finance entry (cash/UPI/bank_transfer/cheque). BRD §6 ban stands. |
| Internal chat | **Full** — 1:1 + group + files + real-time + notifications (deferred to follow-up session, see §"Deferred work" below) |
| Placement / Jobs | **Full** — postings + applications + companies + analytics + resume URL |
| Attendance, assignments, courseware | Confirmed already built (M7, M3, Phase B-2). M10 adds polish + Reports + auto-report cron. |

---

## What shipped in M10 (this session, 2026-05-20)

| PR | Title | Status |
|---|---|---|
| [#24](https://github.com/viditkbhatnagar/India-Learns-LMS/pull/24) | m10a — doc-type enum extensions + faculty quick-access tiles | **MERGED** |
| [#25](https://github.com/viditkbhatnagar/India-Learns-LMS/pull/25) | m10b — dateOfBirth + structured address + emergency + parent/guardian + Student Profile | **MERGED** |
| [#26](https://github.com/viditkbhatnagar/India-Learns-LMS/pull/26) | m10c — Reports module (Attendance / Batch / Assignment) with XLSX export | **MERGED** |
| [#27](https://github.com/viditkbhatnagar/India-Learns-LMS/pull/27) | m10d — Daily attendance auto-report cron (students + parents) | **MERGED** |
| [#28](https://github.com/viditkbhatnagar/India-Learns-LMS/pull/28) | m10f — Placement / Jobs module | OPEN (CI green at time of writing) |
| this entry | m10g — memory + TASKS sweep | OPEN |

Each PR rebased on top of the previous, smoked on production at `https://india-learns-lms.onrender.com` after Render auto-deploy (~3–4 minutes per deploy).

### m10a — Doc-type enum + faculty tiles
- `PROGRAM_REQUIRED_DOC_TYPES` and `APPLICATION_DOCUMENT_TYPES` consolidated into `packages/shared-types/src/enums.ts`. Added: `sslc`, `plus_two`, `degree`, `transfer_certificate`, `passport_photo`. Labels live alongside in `APPLICATION_DOCUMENT_TYPE_LABELS`.
- Threaded through 6 backend files + 3 frontend files. `requiredDocs.max()` Zod limit bumped 10→15.
- 5 quick-access tiles added between the stat row and the courses card on `FacultyDashboard.tsx` — Mark attendance, Grading queue, Course materials, Timetable, Notifications.

### m10b — Student personal details
- New User fields (all nullable): `dateOfBirth: Date`, `personalAddress: { street, city, stateProvince, postalCode, country }`, `emergencyContact: { name, relationship, phoneE164, email }`, `parentGuardian` (same shape).
- New `copyPersonalDetailsFromDraft()` in `applicantConversionService` copies step2 + step3 data onto User at accept-offer.
- `ApplicationDraftStep3Contact` gains optional `parentGuardian` block.
- Three new Cards on `ProfilePage.tsx` (Personal details, Emergency contact, Parent / guardian), each with its own save mutation + banner.

### m10c — Reports module
- Three batch-scoped reports: Attendance, Batch summary, Assignment submissions.
- Unified `/v1/reports/{kind}?format=json|xlsx` surface; XLSX via **exceljs** (new dep).
- Attendance rate: `(present + late) / (totalMarked - excused)` — excused absences don't drag the rate down.
- Faculty authz at the route layer (Enrollment → Course.facultyIds join).
- Submissions matrix: dense by default (every student × every assignment) so "who hasn't started" is visible.
- New `/reports` page with tab switcher + filter form + inline preview + download Excel.
- PDF deferred (req says "PDF or Excel"; Excel is what ops uses).

### m10d — Daily attendance cron
- New Render cron `il-cron-daily-attendance-report` at `0 13 * * *` UTC = 18:30 IST.
- Service iterates UTC day's `AttendanceRecord`, buckets by student, sends email to student + `parentGuardian.email` if set.
- New audit action `jobs.daily_attendance.invoked`.
- WhatsApp deferred (WABA template approval needed; `WHATSAPP_ENABLED=false` by default).

### m10f — Placement / Jobs
- Four new models: `Company`, `JobPosting`, `JobApplication`, plus `User.resumeUrl`.
- Three new enums: `JOB_EMPLOYMENT_TYPES`, `JOB_POSTING_STATES`, `JOB_APPLICATION_STATUSES`.
- 13 endpoints under `/v1/companies`, `/v1/jobs`, `/v1/me/job-applications`, `/v1/job-applications`, `/v1/placement/analytics`.
- `applyToJob` is idempotent (unique `(jobPostingId, studentId)` index); re-apply after withdrawal flips status back to `applied`. Returns 422 RESUME_REQUIRED, 403 PROGRAMME_INELIGIBLE, 409 DEADLINE_PASSED as appropriate.
- Resume snapshot at apply time — later profile edits don't retroactively rewrite past applications.
- Admin console `/admin/placement` (3 tabs: Postings, Companies, Analytics). Student feed `/jobs` auto-scoped to their programme.

---

## Deferred work (next session: PR-E + follow-ups)

### PR-E — Internal Chat (real-time, full)
**Why deferred:** Real-time chat with Socket.IO needs careful architectural thought:
- Sticky sessions on Render (Standard plan supports them; need to verify configuration)
- Redis pub/sub adapter for multi-instance scaling (or stay single-instance for V1)
- JWT auth on socket connections (mirror the HTTP refresh flow)
- File upload integration via existing `storage` adapter
- In-app notification bell + unread counts
- Per-batch group chat auto-membership on enrolment
- Polling fallback for clients that can't hold WebSocket open

Rushing this in one PR alongside five others = reckless. Plan to ship as 3–4 sub-PRs in a follow-up session:
1. Models + REST + polling (Conversation, Membership, ChatMessage, ChatAttachment; ship without WebSocket)
2. Socket.IO server + JWT socket auth + delivery
3. Web UI (chat list, thread view, composer, file upload)
4. Polish + notifications integration

### Other follow-ups
- **Direct resume file upload** via Cloudinary (today: paste URL only).
- **Job-published notification** scoped to matching programmes — extend `NOTIFICATION_TYPES`.
- **Interview scheduling fields** (date/time/location) on JobApplication — today only a free-text `interviewNote`.
- **PDF renderers** for the Reports module (pdfkit).
- **Course-scoped attendance/assignment report variants** for faculty.
- **Sessions-held filter** on attendance report (today shows all sessions in range).
- **Backfill job** for existing students to lift personal details from their ApplicationDraft onto User (one-time).
- **Admin "edit student personal details"** surface so admins can fix data without asking the student.
- **Apply Form step-3 UI** to capture `parentGuardian` during apply (DTO already accepts it; UI hasn't been extended).
- **WhatsApp** template for the daily attendance report (parent channel).

---

## What stays the same

- **No payment gateway.** BRD §6 ban stands. Finance team continues manual entry (cash / UPI / bank_transfer / cheque). Online integration is not on the M10 menu.
- **Attendance + Assignments + Course Materials** are already built (M7 + Phase B-2). M10 added Reports, the daily cron, and Faculty Dashboard tile shortcuts; the underlying record-keeping was already there.
- **Faculty Dashboard structure** — only added the quick-access row; the existing greeting/stats/courses/this-week cards are unchanged.

---

## Production state at end of session

- `https://india-learns-lms.onrender.com` — Render auto-deploy from main, single web service + 9 crons (5 fees/sla/etc + 3 admissions + 1 new daily-attendance).
- Bundle as of m10b/m10c/m10d deploys: contained all marker strings (Class 10 SSLC certificate, Mark attendance tile, ContactRefDto types, etc.) — verified via curl + grep.
- 501/501 tests passing across the merged set.
- One known flake: `analyticsService.test.ts` occasionally fails on first run due to MongoMemoryServer init; rerun is reliable.

---

**Next session start checklist:**
1. Read this file + `/memory/decisions.md` for D-090 onward
2. Check `/TASKS.md` for the deferred PR-E plan
3. Pull `claude/m10g-memory-and-tasks` if it merged; otherwise rebase
4. Begin PR-E sub-PR 1 (models + REST + polling) — see deferred section above
