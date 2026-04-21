# 02 — Product Requirements Document (PRD)

**Product:** India Learns LMS
**Version:** 1.0
**Date:** 21 April 2026

This document specifies every feature, every user story, every acceptance criterion, every permission, and every state machine Claude Code must implement for Phase 1. Anything not in this document is out of scope — if you need something that isn't here, raise it in `QUESTIONS.md` and stop.

---

## 1. Product overview

India Learns is a five-role web + PWA LMS for classroom-based diploma students. It is organised around five pillars:

1. **Identity & access** — admin-created accounts, magic-link onboarding, five roles.
2. **Learning** — courses, modules, quizzes, exams, certificates.
3. **Money** — fee plans, manual payment recording, receipts, reminders, auto-suspension.
4. **Support** — 5-category tickets with SLAs and complaint escalation.
5. **Signals** — feedback from faculty, notifications, analytics.

---

## 2. Personas

### 2.1 Student — "Ayesha, first-year Aviation diploma"
- 20 years old, lives in Bengaluru, classroom-based student.
- Needs: see next class, fees status, new feedback, any open tickets. Watch a module video on the train on the way home.
- Frustrations: being charged or suspended without warning; not knowing what to do when login fails.

### 2.2 Faculty / Course Coordinator — "Mr. Menon, Retail & Fashion coordinator"
- Teaches 2 courses, coordinates 1 cohort.
- Needs: grade essays quickly, give feedback without writing essays himself (templates!), see who hasn't submitted.
- Frustrations: clunky grading tools, forgetting to follow up with a student.

### 2.3 Finance operator — "Finance Associate, LUC India"
- Records cash/UPI/bank-transfer payments by hand.
- Needs: find student fast, record payment, print/send receipt, see who's overdue.
- Frustrations: students ask about balance; she currently opens 4 spreadsheets.

### 2.4 Administration / Operations — "Admin"
- Creates users, manages cohorts, builds the timetable, fields the first ticket.
- Needs: control without having to ask IT; override when the system is wrong.

### 2.5 Superadmin — "Senior Management"
- Read-only oversight. Reviews complaint tickets, monitors SLA breaches, approves overrides.

---

## 3. Roles and permissions

### 3.1 Role matrix

✅ = allowed, 👁 = read-only, ❌ = denied

| Capability | Admin | Superadmin | Finance | Faculty | Student |
|---|:---:|:---:|:---:|:---:|:---:|
| View own dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all users | ✅ | 👁 | 👁 | ❌ | ❌ |
| Create / edit students | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit faculty | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit finance / admin / superadmin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Suspend / unsuspend student manually | ✅ | ❌ | ❌ | ❌ | ❌ |
| Override auto-suspension | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit programs and courses | ✅ | 👁 | ❌ | ❌ | ❌ |
| Upload module videos / PDFs | ✅ | ❌ | ❌ | ✅ (own courses) | ❌ |
| Publish / unpublish course | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / edit batches | ✅ | 👁 | ❌ | ❌ | ❌ |
| Enrol / unenrol students | ✅ | 👁 | ❌ | ❌ | ❌ |
| Manage timetable | ✅ | 👁 | ❌ | ❌ | ❌ |
| View timetable for own batch | ❌ | 👁 | ❌ | ✅ (own courses) | ✅ (own batch) |
| Set / edit fee structure | ✅ | 👁 | ✅ | ❌ | ❌ |
| Record a payment | ❌ | 👁 | ✅ | ❌ | ❌ |
| Issue receipt / resend receipt | ❌ | 👁 | ✅ | ❌ | ❌ |
| View own fees | ❌ | 👁 | ❌ | ❌ | ✅ |
| Send fee reminder (manual) | ❌ | 👁 | ✅ | ❌ | ❌ |
| Create quiz / exam | ✅ | 👁 | ❌ | ✅ (own courses) | ❌ |
| Attempt quiz / exam | ❌ | ❌ | ❌ | ❌ | ✅ |
| Grade essay / give feedback | ❌ | 👁 | ❌ | ✅ (own courses) | ❌ |
| Issue certificate | ✅ (trigger) | 👁 | ❌ | ❌ | ❌ (auto-received) |
| Raise ticket | ❌ | ❌ | ❌ | ❌ | ✅ |
| Raise Complaint ticket | ❌ | ❌ | ❌ | ❌ | ✅ only if prior Resolved/Closed ticket exists |
| Be assigned a ticket | ❌ | ❌ | ✅ (Finance) | ✅ (Academic) | ❌ |
| Reply on ticket | ✅ | ❌ | ✅ | ✅ | ✅ (own, active only) |
| Reopen ticket | ✅ | ❌ | ✅ | ✅ | ❌ (can only request) |
| Close ticket | ✅ | ❌ | ✅ | ✅ | ❌ |
| View all tickets | ✅ | 👁 | 👁 (own category) | 👁 (own category) | ❌ |
| View SLA breach dashboard | ✅ | 👁 | ❌ | ❌ | ❌ |
| Escalate to Senior Management | ✅ | ❌ | ❌ | ❌ | ❌ (auto on Complaint) |
| View analytics dashboard | ✅ | 👁 | 👁 (finance-only) | 👁 (own courses) | ❌ |
| Access audit log | ✅ | 👁 | ❌ | ❌ | ❌ |

### 3.2 Access gating

If a student is `suspended` (for fees), they can still log in, see the Fees page, and raise a **Finance-category** ticket. All other pages return a `403 SUSPENDED_ACCESS` envelope that the UI renders as a full-page blocker with a "Contact Finance" CTA.

### 3.3 Role assignment

One primary role per user. A Faculty can be assigned Admin **additively** only by direct DB edit (not through the UI) — we keep the principle of least privilege in the product.

---

## 4. Global behaviours

### 4.1 Authentication

- **Invite flow (magic link):** Admin creates the user → system generates a one-time token (valid 7 days, single-use), emails a link `https://app.indialearns.com/onboard?t=<token>`, optionally WhatsApps the same. Student clicks → lands on `/onboarding/set-password` → chooses a password → logged in.
- **Login:** email + password. Rate-limited (5 attempts / 15 min / IP), locked 30 min on 10 failures within an hour. Successful login issues an access JWT (15 min) + refresh JWT (14 days, rotated on use).
- **Password reset:** request → email a reset-token link (valid 30 min) → set new password. Reuse prevention: cannot set to the last 3 passwords.
- **Logout:** invalidate refresh token server-side; clear storage client-side.
- **Session cap:** a user can be logged in on max 5 devices. 6th login evicts the oldest.

### 4.2 Notifications

Three channels: email, WhatsApp, in-app bell. Each notification event (see §15) specifies which channels are default-on, default-off, and user-configurable. Launch ships with only the three WhatsApp events Logan confirmed — Fee Due, Payment Received, Ticket Updated.

### 4.3 Global search (minimal)

Admin-only global search across users, courses, and tickets (by code or partial name). Not fuzzy — prefix + regex-escaped match.

### 4.4 Empty and error states

Every list view and detail view must render three distinct states: loading (skeleton), empty (with a helpful CTA), error (with a retry). No blank screens.

### 4.5 Audit log (write actions)

Every staff write action (create, update, suspend, record-payment, override, grade, close-ticket, enrol, unenrol) writes an entry: `{ actor, action, targetType, targetId, before, after, at, ip }`. Visible to Admin at `/admin/audit-logs`.

---

## 5. Authentication & user management module

### 5.1 User stories

- **US-AUTH-01** As Admin, I create a Student by entering name, email, phone, program, batch, and enrolment validity, so the student receives a magic-link email.
- **US-AUTH-02** As Admin, I edit any user's profile, so corrections don't require a DB fix.
- **US-AUTH-03** As Admin, I manually suspend a Student with a reason, so access is blocked until I reinstate.
- **US-AUTH-04** As a new Student, I click the magic link in my invite email, set a password, and land on my dashboard in under 60 seconds.
- **US-AUTH-05** As any user, if I forget my password I request a reset email and get back into my account.
- **US-AUTH-06** As any user, I can change my password from my profile page.
- **US-AUTH-07** As Admin, I see the last login timestamp for every user.

### 5.2 Acceptance criteria

- Admin cannot create a user with a duplicate email (409 with `USER_EXISTS`).
- Magic-link token is single-use and expires in 7 days; second click shows `TOKEN_USED` and offers a fresh invite button (emails Admin).
- Password policy: ≥ 10 chars, must include a letter + digit. Argon2id hash only.
- "Suspended manually" and "Suspended for fees" are distinct states; the UI label distinguishes them.
- Login attempts, successful and failed, are logged to `audit_logs` with IP and UA.

### 5.3 UI inventory

- `/login` (`LoginScreen` in `screens-student.jsx`)
- `/onboarding/landing`, `/onboarding/set-password`, `/onboarding/tour` (from `screens-extras.jsx`)
- `/admin/users` list + filter by role + search
- `/admin/users/new` + `/admin/users/:id` detail/edit
- `/profile` (all roles)

---

## 6. Programs, courses, modules

### 6.1 Model hierarchy

```
Program   (Aviation, Retail & Fashion)
  └─ Course (e.g., "Airline Customer Service")
       └─ Module (ordered list; content blocks within)
            └─ ContentBlock (video | pdf | text | quiz)
```

### 6.2 User stories

- **US-COURSE-01** As Admin, I create a Program, add Courses to it, add Modules to each Course, and add content (video URLs / PDFs / text / embedded quizzes) to Modules.
- **US-COURSE-02** As Admin, I work on a course in **Sandbox** mode, reviewing and editing, then **Publish** it to make it visible to enrolled students.
- **US-COURSE-03** As Admin, I reorder modules by drag-and-drop (optional, Phase 2 if tight on time — per Logan's checklist this was unchecked; implement only if M3 finishes early). **Default: skip.**
- **US-COURSE-04** As a Student, I see a list of my enrolled courses on my dashboard. Clicking a course reveals its modules. Clicking a module reveals its content blocks, which I can play/open inline.
- **US-COURSE-05** As a Student, I see a module as **Completed** once I have opened every content block in it and (if present) passed its quiz. Completion unlocks the next module **only if the course has sequential=true**; otherwise all modules are always accessible.

### 6.3 Acceptance criteria

- Sandbox changes do not appear to students until Publish. Publish creates a new immutable `courseVersion` pointer on affected enrolments — unpublishing rolls back.
- Videos play via Cloudinary URL or a whitelisted YouTube/Vimeo embed. PDFs open in the embedded browser viewer (no external download unless `allowDownload=true` on the content block).
- **No watch-time tracking, no per-page tracking** (confirmed with Logan Q3). Completion is "user clicked play / opened PDF" = boolean.
- Course visibility to a Student requires an active, in-validity Enrollment and a Published course version.

### 6.4 UI inventory

- `/admin/courses` list
- `/admin/courses/new` + `/admin/courses/:id/edit` (with sandbox toggle)
- `/admin/courses/:id/modules` (list + drag-reorder off by default)
- `/student/courses` (from `CourseScreen` in `screens-student2.jsx`)
- `/student/courses/:id/module/:moduleId`

---

## 7. Batches and enrolment

### 7.1 Batches

- Every Student belongs to exactly one Batch at a time.
- Batch has: name (e.g., "Aviation Batch 1 — July 2026"), program, start date, end date, capacity (default 30), and a weekly timetable (see §10).
- Admin can move a Student between batches (audited).

### 7.2 Enrolment

- Enrolment ties `{ student, batch, course, validFrom, validTo, status: active | expired | revoked }`.
- On Batch creation, Admin can mass-enrol the batch in all Courses of its Program (one click).
- Enrolment is automatically revoked if the student's account is revoked.

### 7.3 User stories

- **US-ENROL-01** As Admin, I create a batch, enrol students into it, and mass-enrol them into all of the Program's Courses.
- **US-ENROL-02** As Admin, I unenrol a single student from a single course without affecting the rest of their enrolment.
- **US-ENROL-03** As a Student, I only see courses I'm actively enrolled in.

### 7.4 Acceptance criteria

- A Batch cannot exceed its capacity (default 30). Over-capacity attempt returns `BATCH_FULL`.
- A Student cannot be active in two Batches of the same Program at the same time.

---

## 8. Timetable

### 8.1 Structure

- Weekly recurring schedule per Batch (confirmed with Logan Q22).
- A timetable entry has: `{ batch, course, faculty, dayOfWeek, startTime, endTime, room?, notes? }`.
- Support for one-off overrides: a specific date's entry can be cancelled or moved.

### 8.2 User stories

- **US-TT-01** As Admin, I set the weekly timetable for a Batch — each day shows a list of classes, draggable within the day.
- **US-TT-02** As Admin, I add an override for a specific date (e.g., "No class on 15 Aug — public holiday" or "Class moved to 3 pm").
- **US-TT-03** As a Student, I see my week at a glance on my dashboard + a full calendar view.
- **US-TT-04** As a Faculty, I see only my own classes.
- **US-TT-05** As Admin, when I change the weekly timetable, all students and assigned faculty are notified via email + in-app (WhatsApp optional, off by default for launch).

### 8.3 Acceptance criteria

- No two timetable entries overlap for the same Batch, same Faculty, or same Room.
- An override persists the original recurring slot and overlays a dated variant — the recurring slot reappears the following week.
- Display always renders in `Asia/Kolkata`.

### 8.4 UI inventory

- `/admin/timetable` (by batch)
- `/student/timetable` (`TimetableScreen`)
- Dashboard widget (`StudentDashboard`) showing next 3 classes.

---

## 9. Fees module

This is the heaviest module. Build it exactly as described.

### 9.1 Fee structure model

A **FeeStructure** is attached to a Program (or, overrideable, to a specific Enrolment). It lists **FeeComponents**, each one of:

| Component | Cadence | Default due date rule |
|---|---|---|
| Registration fee | One-time | On enrolment |
| Monthly tuition | Monthly × N months | Day 1 of each month, starting month of batch start |
| Examination fee | One-time or per-exam | Set by Admin per course |
| Certification fee | One-time | Month before batch end |
| Miscellaneous (trips, consumables, etc.) | Ad-hoc | Set case-by-case by Admin |

On Enrolment, the system generates an **Invoice** per component with **Installments** (one per cadence point). Each Installment has `{ amountPaise, dueDate, status: pending | paid | partial | overdue | waived }`.

### 9.2 Recording a payment (Finance)

Finance-only UI at `/finance/payments/new` and `/finance/students/:id/record-payment`:
- Pick a student (search).
- See their outstanding installments (oldest first).
- Enter amount paid + payment method (cash | upi | bank_transfer | cheque | other) + reference (e.g., UPI txn id) + date received.
- Preview allocation (auto-allocates oldest-first across pending installments; Finance can override allocation).
- Confirm → creates a `Payment` record, updates installment statuses, generates a `Receipt` PDF via `ReceiptService`, emails + optionally WhatsApps the receipt to the student.

### 9.3 Student fees page

Shows (matching `FeesScreen` in `screens-student2.jsx`):
- Total fees (sum of all components).
- Paid amount.
- Balance outstanding.
- Next due date + amount.
- Full installment plan table — component, due date, amount, status, receipt link if paid.
- Payment terms (static text per FeeStructure).

### 9.4 Fee reminder schedule (per installment)

Exactly these 7 fire points, confirmed by Logan Q9 (with his 14-day-before addition):

| # | Fires when | Channels | Template |
|---|---|---|---|
| T0 | **14 days before** due date | Email + in-app | `FEE_UPCOMING_14D` |
| T1 | **7 days before** due date | Email + WhatsApp + in-app | `FEE_UPCOMING_7D` |
| T2 | **On** due date (09:00 IST) | Email + WhatsApp + in-app | `FEE_DUE_TODAY` |
| T3 | **3 days overdue** | Email + in-app | `FEE_OVERDUE_3D` |
| T4 | **14 days overdue** | Email + WhatsApp + in-app — **Warning 1** | `FEE_WARNING_1` |
| T5 | **21 days overdue** | Email + WhatsApp + in-app — **Warning 2** | `FEE_WARNING_2` |
| T6 | **28 days overdue** | Email + WhatsApp + in-app — **Access suspended** | `FEE_SUSPENDED` |

Installment cron runs hourly and fires reminders whose scheduled time has passed and that haven't been marked sent. Idempotency key: `{installmentId}:{templateId}`.

### 9.5 Auto-suspension state machine

```
pending ──(due date passes)──▶ overdue ──(3d)──▶ overdue ──(14d)──▶ warn1 ──(21d)──▶ warn2 ──(28d)──▶ suspended
                                                                                                                      │
       paid ◀──(Finance records payment, balance clears)───────────────────────────────────────────────────────────┘
                                                                                                                      │
                                                                   override_active ◀──(Admin sets override until <date>)┘
```

- `warn1`, `warn2`, and `suspended` are states on the **Student**, not the Installment; the Installment stays `overdue` until paid.
- **Admin override:** at any state, Admin sets `suspensionOverride: { until: <date>, reason: string, by: adminId, at }`. While active, Student state falls back to `overdue` (still receives reminders). When override expires and balance remains, state returns to whichever stage the timeline would otherwise be in.
- **Recovery:** when balance clears to zero, Student returns to `active`. Admin can manually reinstate via "Unsuspend" (audited).
- **Blocked pages during `suspended`:** every page except `/fees`, `/profile`, `/tickets/new?category=Finance`, and `/logout`. Middleware returns `403 SUSPENDED_ACCESS` on other routes.

### 9.6 Receipts

- Receipt numbering: `RCP-2026-000001` (reset counter annually on 1 Apr).
- Receipt PDF fields: LUC / India Learns logo, registered address (from env), GSTIN if present (from env), receipt number, date, student name + IL code, program, component(s) allocated, amount in words + figures, payment method + reference, "System-generated receipt" footnote.
- A receipt is immutable once issued. Corrections issue a **Credit Note** PDF referring to the original.

### 9.7 User stories

- **US-FEE-01** As Finance, I record a ₹5,000 cash payment against a student, see it auto-allocate to the September tuition installment, and the student receives the receipt within 10 seconds.
- **US-FEE-02** As a Student, I see that my October installment is due in 6 days, along with the total I've paid to date.
- **US-FEE-03** As a Student whose October fee is 15 days overdue, I see a "Warning: your account will be suspended in 14 days" banner on the Fees page.
- **US-FEE-04** As an Admin, I override a student's auto-suspension for 30 days with a reason; the student regains access immediately; the override expiry is on my dashboard.
- **US-FEE-05** As Finance, I can reverse a recorded payment within 24 hours; a credit note PDF is generated; installment balances revert.
- **US-FEE-06** As Admin, I see total collected this month, YTD, and top 5 students by outstanding balance.

### 9.8 UI inventory

- `/finance/dashboard` (`FinanceDashboard`)
- `/finance/students` (search)
- `/finance/students/:id` + `/finance/students/:id/record-payment`
- `/finance/payments` (list, filter)
- `/finance/reports` (collections by period, by component, by batch)
- `/student/fees` (`FeesScreen`)
- Student dashboard widget (next installment)

---

## 10. Ticketing module

### 10.1 Categories & routing (Logan Q12 + Q13)

| Category | Assignee team | Default SLA ack | Default SLA resolve |
|---|---|---|---|
| Academic Support | Course Coordinator (Faculty) | 24 h | 5 days |
| Administration | Operations / Admin team | 24 h | 5 days |
| Finance | Finance / Accounts | 24 h | 5 days |
| Technical Support | IT / System Admin | 24 h | 5 days |
| Complaints & Appeals | Senior Management | 24 h | **15 business days** |

**Routing logic:**
- Academic: if the ticket's `linkedCourseId` is set → assignee = that course's Faculty; else round-robin among `role:Faculty` flagged `isCourseCoordinator=true`.
- Administration: round-robin among `role:Admin` where `deptTag='operations'`.
- Finance: round-robin among `role:Finance`.
- Technical: assigned to single `role:Admin` where `deptTag='it'` (configurable).
- Complaints & Appeals: assigned to the `superadmin` pool; notifies all `role:Superadmin`.

### 10.2 Ticket state machine (Logan Q14)

```
      ┌──────────────────────────────┐
      │                              ▼
 Open ──▶ Assigned ──▶ In Progress ──▶ Resolved ──(7d passes)──▶ Closed
                                            ▲                       │
                                            │                       │
                                            └─ Reopen (staff only, within 7 days of Resolved OR Closed)
```

- **Transitions on `Open → Assigned`:** automatic on creation via routing logic.
- **`Assigned → In Progress`:** first staff comment or explicit "Start" button.
- **`In Progress → Resolved`:** staff clicks "Resolve" and writes a resolution note.
- **`Resolved → Closed`:** automatic 7 days after Resolved, OR student clicks "Confirm closed", OR staff clicks "Close now".
- **Reopen:** only **staff** can reopen, and only within **7 days** of Resolved or Closed. Students can **request** reopen from a closed ticket — that creates a new child ticket linked to the parent; original stays closed. After 7 days, no reopen of either kind: student raises a new ticket.

### 10.3 Complaint precondition (Logan Q7 — stricter)

Student cannot raise a `Complaints & Appeals` ticket unless they have at least one **Resolved** or **Closed** ticket in any other category. Enforced server-side (`COMPLAINT_PRECONDITION_UNMET`) and the UI disables the "Complaint" option with a tooltip.

### 10.4 SLA timers

- **Acknowledgement SLA** starts at ticket creation, stops when state ≥ Assigned with a staff comment OR state ≥ In Progress. Breach alert: email to assignee + their manager.
- **Resolution SLA** starts at ticket creation, stops at Resolved. Breach alert: email to assignee + their manager + Admin.
- Complaints use 15 business days (Mon–Fri, excluding public holidays — hard-code Indian public holidays; Admin can edit the list at `/admin/holidays`).
- Admin dashboard shows breach counts and a leaderboard.

### 10.5 Comments / replies

- Students can reply only on tickets in state `Open | Assigned | In Progress`. Cannot reply on `Resolved | Closed`.
- Staff can reply in any state.
- Each comment has `{ author, body, attachments[], visibility: public | internal, at }`. `internal` comments hide from students.

### 10.6 User stories

- **US-TKT-01** As a Student, I raise an Academic ticket from my dashboard in under 20 seconds.
- **US-TKT-02** As a Student with no prior Resolved/Closed ticket, the "Complaints & Appeals" option is greyed out with a tooltip.
- **US-TKT-03** As Faculty, I get an email when a new Academic ticket is assigned to me; the email links me straight to the ticket.
- **US-TKT-04** As a Staff member, I post a reply, attach a file, and change the status in one click.
- **US-TKT-05** As Admin, I see all tickets filterable by category / status / student / assignee / SLA breach.
- **US-TKT-06** As a Student, I request reopening of a ticket that was closed 4 days ago. Staff receives the request as a new, linked ticket.
- **US-TKT-07** As a Superadmin, I receive every Complaint & Appeal at creation and can reassign, reply, and close.

### 10.7 UI inventory

- `/student/tickets` (`TicketsScreen`) — list + filter.
- `/student/tickets/new` + `/student/tickets/:id`
- `/staff/tickets` + `/staff/tickets/:id` (works for Admin / Finance / Faculty / Superadmin with appropriate filter)
- `/admin/tickets/sla-breaches`
- Dashboard widgets on each role.

---

## 11. Feedback module

### 11.1 Scope (Logan Q18–Q21)

Faculty can give feedback at three levels:
- Per **Assignment** (submissions within a module).
- Per **Module** (summary across the module).
- Per **Assessment** (quiz or final exam).

Formats (combined, not exclusive):
- **Rubric** — structured criteria with scores (configurable per course).
- **Written comments** — free-text (markdown subset).
- **Summary** — an overall short paragraph visible on the student's main feedback dashboard.

**One-way.** Students see feedback, are notified, but cannot respond inside the system. They can raise an Academic ticket if they want to discuss.

### 11.2 Rubric model

- Admin or Faculty defines a **Rubric** per course with N criteria, each with a scale (numeric or labelled like "Developing / Competent / Proficient / Exemplary").
- A **FeedbackEntry** references a rubric and stores per-criterion scores + overall comments + summary.
- Rubric templates exist so Faculty can reuse a rubric across many students.

### 11.3 Notification

- Email + in-app (confirmed Q20). WhatsApp off by default for launch to keep template load manageable.
- Notification fires when a FeedbackEntry is marked `published=true`. Drafts don't notify.

### 11.4 User stories

- **US-FB-01** As Faculty, I pick a student + a module → the rubric pre-fills → I score each criterion, write a 2-line summary, click Publish, student gets email + bell notification.
- **US-FB-02** As Faculty, I save a **Feedback Template** (e.g., "Good participation, needs work on X") and apply it with one click to any student.
- **US-FB-03** As a Student, I see all my feedback chronologically on `/student/feedback`, with filters by course/module.
- **US-FB-04** As Admin, I see feedback coverage per faculty — % of assignments with feedback within 7 days.

### 11.5 UI inventory

- `/faculty/feedback` list + filter by batch/course
- `/faculty/feedback/new` + edit
- `/faculty/rubrics` + templates
- `/student/feedback` (`FeedbackScreen`)
- Student dashboard widget (latest 3 feedback items).

---

## 12. Assessments (quizzes and final exams)

### 12.1 Model

- **Quiz** attached to a Module. Type: MCQ only (single or multi-correct per question). Max attempts (default 3), passing score (default 60%), time limit optional.
- **Final Exam** attached to a Course. Type: mixed MCQ + essay questions. Max attempts (default 1), passing score (default 50%), time limit typically 2 h.

### 12.2 Life cycle

`Draft → Scheduled → Live → Closed → Graded`

- Essay questions require manual grading by Faculty with per-question rubric + comments.
- MCQs auto-graded.
- Student sees their attempt history; if not-yet-graded, placeholder "Grading in progress".

### 12.3 User stories

- **US-ASM-01** As Faculty, I create a quiz with 10 MCQs, 3 max attempts, passing 60 %.
- **US-ASM-02** As a Student, I attempt the quiz. On submission I see my MCQ score immediately and "Essay grades pending" if there were any.
- **US-ASM-03** As Faculty, I grade essay questions with per-question scores and written feedback; Student gets notified when all questions are graded.
- **US-ASM-04** As Faculty, I review attempt history and analytics (avg score, common wrong answers).

### 12.4 No AI exam generation

Explicitly out of scope. Faculty hand-writes questions.

### 12.5 UI inventory

- `/faculty/quizzes` + `/faculty/quizzes/:id`
- `/faculty/exams` + `/faculty/exams/:id`
- `/faculty/grading` (queue of ungraded essays)
- `/student/courses/:id/module/:moduleId/quiz/:quizId`
- `/student/courses/:id/exam/:examId`

---

## 13. Certificates

### 13.1 Flow

- When a Student's Enrolment is complete (all Modules' content opened + all Quizzes passed + Final Exam passed), the system marks the Enrolment `completed=true`.
- Admin can **Issue Certificate** from the Enrolment detail page — this calls `CertificateService.issue({ studentName, courseName, completionDate })` which posts to Certifier.io and stores the returned certificate URL on the Enrolment.
- Email + in-app notification with a link to view/download the certificate.

### 13.2 Acceptance criteria

- Certificates are idempotent — re-issuing returns the existing URL.
- If Certifier fails, the UI surfaces a clear error and a Retry button. No silent failure.

### 13.3 UI inventory

- Admin Enrolment detail page with "Issue Certificate" button.
- Student `/student/certificates` and `CertificateScreen`.

---

## 14. Notifications

### 14.1 Channels

- **Email:** Resend primary, SendGrid fallback. Sender: `notifications@app.indialearns.com`. All emails have an unsubscribe URL for non-transactional; transactional emails are legally exempt but still include a "preferences" link.
- **WhatsApp (Meta WABA):** template-only for Launch (three templates — Fee Due, Payment Received, Ticket Updated). All WhatsApp sends go through `WhatsAppService.sendTemplate({ to, templateName, vars })`.
- **In-app:** a bell dropdown in the header, backed by `Notification` collection with `{ user, type, body, actionUrl, readAt }`.

### 14.2 User preferences

- `/profile/notifications` shows per-event toggles for email and (where WABA-available) WhatsApp. In-app always on.

### 14.3 Event registry (launch)

| Event | Email | WhatsApp | In-app | Role |
|---|:---:|:---:|:---:|---|
| Account created (invite) | ✅ (magic link) | — | — | All |
| Password reset | ✅ | — | — | All |
| Fee upcoming T-14 | ✅ | — | ✅ | Student |
| Fee upcoming T-7 | ✅ | ✅ | ✅ | Student |
| Fee due today | ✅ | ✅ | ✅ | Student |
| Fee overdue T+3 | ✅ | — | ✅ | Student |
| Fee overdue T+14 (Warn 1) | ✅ | ✅ | ✅ | Student |
| Fee overdue T+21 (Warn 2) | ✅ | ✅ | ✅ | Student |
| Fee overdue T+28 (Suspend) | ✅ | ✅ | ✅ | Student |
| Payment received | ✅ | ✅ | ✅ | Student |
| Ticket created (to assignee) | ✅ | — | ✅ | Staff |
| Ticket status change | ✅ | ✅ | ✅ | Student + Staff |
| Ticket comment (to counterparty) | ✅ | — | ✅ | Student + Staff |
| SLA breach alert | ✅ | — | ✅ | Assignee + Manager |
| New feedback | ✅ | — | ✅ | Student |
| Class cancellation / reschedule | ✅ | — | ✅ | Batch students + Faculty |
| Certificate issued | ✅ | — | ✅ | Student |

---

## 15. Analytics & reporting

Admin dashboard widgets (each is a card with a headline number + 14-day sparkline):

- Students active / suspended / in-trial today.
- Admissions this month / YTD.
- Fees collected (this month / YTD / outstanding).
- Quiz / exam pass rate (by course).
- SLA breaches (this week).
- Avg feedback coverage % (last 7 days).
- API & SaaS spend tracker (monthly, per provider — Cloudinary, Resend, WABA, Certifier). Read from provider APIs where available; otherwise record usage counters internally and multiply by known rates.

Reports (downloadable CSV):
- Student roster by batch.
- Collections by component / date range.
- Outstanding balances.
- Ticket volume by category / SLA breach status.
- Feedback coverage per faculty.

---

## 16. Accessibility, copy, and micro-UX

- WCAG 2.1 AA target. Colour contrast on brand orange/navy/cream verified in the UI/UX Spec.
- All form fields labelled; errors attached to field; keyboard navigation supported.
- Copy is crisp, friendly, no jargon. Student-facing status labels avoid finance-speak: "Balance due" not "AR outstanding".
- Time stamps: "Today 3:45 pm" / "Yesterday" / "Mon 21 Apr, 9:00 am".
- Money: "₹12,500" (Indian numbering).
- Phone numbers: stored E.164 (`+91...`), displayed `+91 98XXX XXXXX`.

---

## 17. Out of scope (repeat from BRD, do not build)

- Online payment gateway.
- Native mobile apps.
- AI flashcards, voice AI, AI question generation.
- Live class / Google Meet integration.
- Watch-time and page-tracking analytics.
- Public marketing page.
- Refunds.
- Bulk enrolment / bulk fee ops (UI-side; DB supports it).

---

_Next: see `03_TRD.md` for schemas, endpoints, and architecture._
