# M10s — Visitor Leads + manual installments + faculty publish + completion notif

**Decision:** [D-096](/memory/decisions.md).

## What changed

1. **New Visitor Leads module.** `/v1/visitor-leads` (admin-only CRUD) + `/admin/visitor-leads` sidebar page. Pre-application funnel — capture walk-ins / agent / Google / Meta / Instagram inbound leads. OTP status is a manual flag (no OTP send).
2. **Manual installment editing.** Admin can `PATCH /v1/installments/:id` to edit label/amount/due date/status, `POST /v1/installments` to add custom rows, and `POST /v1/installments/:id/waive` to drop one from totals. Invoice totals recompute automatically. Surfaced on `/finance/students/:id`.
3. **Faculty publishes courses.** `publishCourse` + `unpublishCourse` open to faculty assigned to the course. CourseShell header shows the buttons.
4. **Course-completion admin notif.** Sibling listener on `course.completed` pings every admin + superadmin via in-app + email.

## Test plan

### A. Visitor Leads
1. **Admin login.** Sidebar → "Visitor Leads".
2. **Add lead.** Click "Add lead". Fill First/Last/Phone (+919876543210)/Source=Meta → Create. Lead appears in the table with status=New, OTP=Pending.
3. **Edit + verify.** Click "Edit". Toggle OTP→Verified, Status→Qualified, add notes. Save.
4. **Duplicate phone rejected.** Try adding another lead with the same phone — expect 409 `LEAD_EXISTS`.
5. **Search + filter.** Type into the search box (matches name/email/phone). Filter by source/status.
6. **Soft-delete.** Click Edit → Delete → confirm. The lead disappears from the active list; phone is freed for re-capture.
7. **Student/faculty 403.** Log in as a non-admin and hit `/admin/visitor-leads` — redirected; API returns 403.

### B. Manual installments
1. **Pre-req:** A student with an enrolment + auto-generated installments.
2. Admin → Finance → click the student.
3. **Edit row.** Click "Edit" on an installment → change amount to e.g. 25000 → Save. Invoice "Total" updates immediately.
4. **Add custom row.** Click an invoice button under "Add installment to an invoice" → fill "Seat Reservation", 1500, today's date → Add. New row appears in the list.
5. **Waive a row.** Click "Waive" on a pending row → confirm. Row shows `waived` badge; invoice total drops by that amount.
6. **Amount-below-paid guard.** Try to PATCH amount to less than the already-paid value → expect 422 `AMOUNT_BELOW_PAID`.

### C. Faculty publishes courses
1. **Pre-req:** Faculty user assigned to a course that's in `sandbox` state.
2. Login as that faculty → "My courses" → click the course.
3. Course header shows "Publish course" button. Click it.
4. Course state flips to `published`. Header now shows "Unpublish".
5. Click "Unpublish" → confirm. State reverts to `sandbox`. Students in that programme lose access.
6. **Negative case:** Faculty NOT on roster gets 403 from `POST /v1/courses/:id/publish` (and won't see the button in the UI).

### D. Course-completion admin notif
1. Log in as student. Complete the last quiz/exam needed to finish a course.
2. (Backend) `course.completed` event fires.
3. Log in as admin / superadmin → notification bell shows the new "Student X completed Course Y" entry. Email also delivered (or logged via ConsoleEmailAdapter in dev).

### E. Regression
- 514/514 tests pass.
- typecheck + lint clean.
- Existing flows untouched: M5 fees / receipts, M7 grading, M8 certificates, M10 chat + announcements.

## Roll-back

- Visitor Leads: drop the `/v1/visitor-leads` mount; the model + UI route are isolated. Existing data stays in the `visitorleads` Mongo collection (no harm).
- Installments: revert `installmentService.ts` + `installments.ts` routes + the InstallmentsCard rebuild. Auto-gen still works.
- Faculty publish: revert `assertCanPublishCourse` change in courseService back to `assertAdmin`. Hide the publish/unpublish buttons in CourseShell for non-admins.
- Completion notif: drop the sibling listener block in certificateService. Certificate flow is unaffected.
