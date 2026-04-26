# Admin Handbook

The day-to-day operations manual for India Learns admins at LUC. As an admin, you manage users, programmes, batches, timetables, fees, tickets, and the academic structure that students experience.

> **Tip:** Superadmins have everything in this handbook plus role assignment and audit-retention controls — see [superadmin-handbook.md](superadmin-handbook.md).

## 1. Sign in and dashboard

### 1.1 Sign in

`{{WEBSITE_URL}}/login` — same flow as students. After **10 wrong tries** in 15 minutes, your account locks for 30 minutes.

### 1.2 Admin dashboard

`/admin/dashboard`

KPI cards:

- **Active students** — current cohort size.
- **Active courses** — published courses.
- **Open tickets** — count + breakdown by SLA state.
- **Outstanding fees** — total ₹ pending across all students.
- **SLA breaches today** — the priority queue.

Use this as your morning check-in.

## 2. Users

`/admin/users`

### 2.1 Listing and filtering

Filters:

- **Role** — student / faculty / admin / finance / superadmin.
- **Status** — pending / active / suspended (manual or fees) / revoked.
- **Programme / batch** — for student / faculty filters.
- **Search** — by name, email, or student code.

Each row shows a status pill. Click to open the user.

### 2.2 Inviting a new user

Click **Invite user**:

1. Choose role.
2. Enter name, email, phone (E.164), address.
3. For students: pick programme + batch + enrolment validity dates.
4. For faculty: pick course assignments.
5. Click **Send invite**. The system emails a magic link, valid for **7 days**.

If the user doesn't accept in time, click **Resend invite** to reset the clock.

### 2.3 Editing a user

Click any user, then **Edit**. You can change:

- Profile fields (name, phone, address).
- Programme / batch (for students).
- Course assignments (for faculty).
- Enrolment validity dates.

You cannot change a user's email — that requires a superadmin and creates a fresh invite.

You cannot escalate roles — only superadmin does that. The `Role` field is locked to your view.

### 2.4 Suspending and unsuspending

There are two suspension kinds:

| Kind | Triggered by | Effect |
|---|---|---|
| **Manual** | Admin action | Hard block — user cannot log in or use any feature |
| **Fees** | Cron when student is past due | User can still log in, sees fees + dashboard + finance tickets only |

To **manually suspend**: open the user, click **Suspend**, choose reason. Confirm. The user receives a notification.

To **unsuspend (manual)**: click **Unsuspend** with reason.

For fees suspension, do not unsuspend manually unless you've already worked out a plan with finance. Use the **Override fees suspension** action with a justification and an end date — finance reviews these.

### 2.5 Soft-deleting a user

Click **Delete user** to soft-delete. The user's status becomes `revoked`, all sessions are killed, and the user disappears from default lists. You have **90 days** to undo a soft-delete by changing the status back. After 90 days, a retention sweep hard-deletes the row.

## 3. Programmes, courses, modules

### 3.1 Programmes

`/admin/programs`

A programme is a top-level offering (Aviation, Retail & Fashion, etc.). Each programme contains courses.

To create one: click **New programme**, fill in name, description, duration, certification details. Save.

### 3.2 Courses

From a programme, click **Courses** to add courses. Each course has:

- Title, code, description, learning outcomes.
- Modules and sessions (added later via the Course Shell — see [faculty-handbook.md](faculty-handbook.md) §3).
- Sandbox vs Published state. Sandbox courses are invisible to students until published.

### 3.3 Modules and sessions

Sessions are the structural units inside a module. They can be:

- Created manually in the Content tab.
- Imported from a curriculum source — see §11.

Both faculty and admin can edit course content; admin actions are audit-logged.

## 4. Batches

`/admin/batches`

A batch is a cohort within a programme — a group of students who progress together.

For each batch:

- Title (e.g., "Aviation 2026 Cohort 1").
- Programme.
- Start and end dates.
- Capacity (max 30 per CLAUDE.md §1).
- Assigned faculty (per course).

### 4.1 Batch detail

`/admin/batches/:id` — see roster, course assignments, timetable.

## 5. Enrolments

`/admin/enrollments`

The link between a student and a batch + courses they're taking.

### 5.1 Bulk enrol

Click **Bulk enrol**. Upload a CSV of students or pick from existing users. Choose the batch, validity dates. Confirm.

### 5.2 Per-enrolment detail

`/admin/enrollments/:id` — student, batch, courses, validity, completion status. From here you can:

- **Generate fees** — creates the invoice + instalments per the fee structure.
- **Issue certificate** — admin retry of certificate issuance after course completion.
- **Mark complete** — only when all coursework is finished and fees are clear.

## 6. Timetable

### 6.1 Timetable builder

`/admin/timetable`

For each batch:

- Add **timetable entries** — recurring weekday slots with start/end times in IST.
- Add **timetable overrides** — per-day cancellations or reschedules (e.g., a national holiday or an emergency).

Conflicts (e.g., two courses scheduled in the same slot for the same batch) are flagged at save time.

### 6.2 Holidays

`/admin/holidays`

A holiday cancels classes for that day across all batches. Add national, regional, or institute holidays in advance — students see them on their timetables.

### 6.3 Notifications

When you publish a timetable change, students receive notifications (email + WhatsApp if enabled) automatically.

## 7. Fee structures

`/admin/fee-structures`

A fee structure defines the components a programme charges:

- **Tuition**, **Examination**, **Material**, **Miscellaneous**.
- Per-component amounts in paise (₹1 = 100 paise) — the platform handles conversion.
- Number of instalments and the due-date schedule.

### 7.1 Generating fees for an enrolment

After an enrolment is created, click **Generate fees** on the enrolment detail page. This creates:

- An invoice (with code `INV-YYYY-NNNNNN`).
- One or more instalments per the structure.

Edit individual instalment amounts only when LUC has explicitly granted a concession; every change is audit-logged.

## 8. Tickets

### 8.1 Inbox

`/admin/tickets`

Filter by category, state, SLA status.

- **All** — every ticket in the system.
- **Mine** — assigned to you.
- **Unassigned** — not yet routed.
- **SLA at risk** — within 24 hours of breach.
- **SLA breached** — past target.

### 8.2 SLA breaches

`/admin/tickets/sla-breaches` — dedicated dashboard. Each row shows the target, the current age, and the breach.

### 8.3 Working a ticket

Open `/admin/tickets/:id`:

- Read the description and the thread.
- Comment publicly (visible to the requester) or internally (visible only to staff).
- Assign to a staff member.
- Transition the state: **Acknowledged → In progress → Resolved → Closed**.

A **Resolved** ticket can be reopened by the requester within **15 days**. After that, it auto-closes.

### 8.4 Complaints

The **Complaints** category has stricter rules:

- Cannot be raised unless the requester has a prior Resolved/Closed ticket on a related topic.
- 15-business-day SLA.
- Routed automatically to senior staff.

## 9. Curriculum import

`/admin/curriculum-import` (superadmin role)

When a course's curriculum is authored externally and synced to India Learns:

1. Paste the workflow ID.
2. **Preview** — see what will change without committing.
3. **Run import** — apply the changes. The platform dedupes based on stable IDs so re-imports are safe.
4. **Health check** — confirms the imported structure is valid.

If you suspect a partial import, the platform now auto-recovers state on next run (per recent fix).

## 10. Audit logs

`/admin/audit-logs`

Filter by:

- **Actor** — who did it.
- **Target** — what was affected.
- **Action** — `user.created`, `payment.recorded`, etc.
- **Date range**.

Use this when:

- A student disputes an action.
- You need to confirm what staff did during a window.
- A regulator or auditor asks for evidence.

Audit rows are append-only by convention — there is no edit / delete UI. Retention is **7 years** per [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md).

## 11. Announcements

Announcements are course-scoped (see [faculty-handbook.md](faculty-handbook.md) §10). Admin can post to any course; faculty can post only to assigned courses.

## 12. Common issues

| If… | Try this |
|---|---|
| An invite link expired | Resend from the user's detail page. The token is reset for another 7 days. |
| A student says they paid but nothing shows | Cross-check with finance — payment recording is manual. If finance has recorded it, the platform should reflect within minutes. |
| A faculty says they can't see a course | Check the course is in the **Published** state and the faculty is assigned. Sandbox courses don't appear to faculty. |
| A ticket is stuck unassigned | Use the **Unassigned** filter every morning. Auto-routing is best-effort; manual assignment is the safety net. |
| Two timetable entries collide | The builder warns at save time. If saved anyway, edit one to resolve. |
| You suspect data was changed by mistake | Audit log filtered by target ID will show before/after. |

## 13. Privacy responsibilities

- **Don't share PII outside the platform.** Use ticket comments rather than email.
- **Don't write notes about a student in a place students can read.** Use the internal-comment toggle.
- **Don't extract data into spreadsheets.** If you need a report, request it via finance / admin tooling — extraction is a regulated activity per [../compliance/dsar-procedure.md](../compliance/dsar-procedure.md).
- **Treat ticket attachments as sensitive.** Some include health, financial, or family information.

## 14. Where to go next

- [Superadmin handbook](superadmin-handbook.md) — extended powers.
- [Finance handbook](finance-handbook.md) — for fee-related workflows.
- [Faculty handbook](faculty-handbook.md) — when you act on behalf of a faculty.
- [Operations runbook](../operations/on-call-runbook.md) — for technical incidents.
- [Audit + access controls](../security/access-control.md) — what's logged and who can see it.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with Rejin (LUC operations). Review cadence: per release._
