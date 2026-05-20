# India Learns — Platform Overview

A Learning Management System for Diploma Programs. Built for students, faculty, finance, and administration — in one place.

**Staging URL:** https://india-learns-lms.onrender.com

---

## 1. Test Credentials

> Staging environment only. Do not use these for production. If this document is shared externally, rotate the passwords on close of review.

### Web portal sign-in

Open the staging URL above and sign in with any of the accounts below.

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@indialearns.test | Superadmin#2026 |
| Student | student-seed-1@luc.local | Student#12345 |
| Faculty | faculty-seed-1@luc.local | Faculty#12345 |
| Student — Demo #1 | student-demo-1@luc.local | Student#12345 |
| Student — Demo #2 | student-demo-2@luc.local | Student#12345 |
| Student — Demo #3 | student-demo-3@luc.local | Student#12345 |

> **M10r — `finance` role removed (D-095).** The previous seeded
> `finance-seed-1@luc.local` user is deprecated; their record still
> exists in the DB with the legacy `role: 'finance'` but every route
> now rejects that role token. Either soft-delete the user via
> Admin → Users, OR run a one-shot migration to promote them to admin
> (`db.users.updateMany({role:'finance'}, {$set:{role:'admin',
> deptTag:'finance'}})`). Admin handles all finance work now — record
> payments, issue receipts, manage fees, take finance-category tickets.

### Where each role lands after sign-in

- **Super Admin** — Admin dashboard in read-only mode (sees everything; cannot write).
- **Student** — Student dashboard with an active enrolment, fees summary, tickets, and a certificate.
- **Faculty** — Faculty dashboard with their assigned course and this week's timetable.
- **Finance** — Finance dashboard with the "Record payment" flow and a collections snapshot.
- **Student — Demo #1** — Student dashboard using demo data (3 installments at a 40 / 30 / 30 split).
- **Student — Demo #2, #3** — Student dashboards with additional demo data.

**Admin** (non-read-only) is not seeded by default. Create one on the fly: sign in as the Super Admin → **Users → Invite user → role: Admin**. The invitee receives a magic-link email.

### Notes
- First sign-in may take 15–30 seconds while the staging server wakes up.
- On mobile, the layout adapts automatically — same credentials, same URL.
- For testing password reset: use **Forgot your password?** on the sign-in page with any valid email.

---

## 2. What the Platform Does

### For Students
- **Personalised dashboard** with a time-of-day greeting, next class, outstanding fees at a glance, open tickets, unread notifications, and recent certificates.
- **My courses** — video lessons, PDF handouts, text content, and embedded quizzes, organised by module.
- **Weekly timetable** with a week-picker. Shows the faculty for each session, the room, and flags any rescheduled or added classes.
- **Fees** — a clear outstanding-balance hero card with a payment-progress bar, a full installment schedule, and downloadable PDF receipts for every payment.
- **Tickets** — raise a support ticket in five categories (academic, administrative, finance, technical, complaints). Track the conversation, see SLA status, and request reopen within 7 days of closure.
- **Feedback** — read faculty's rubric scores, written comments, and summary notes for each assessment.
- **Certificates** — download verifiable course-completion certificates. Each is issued automatically when the completion criteria are met.
- **Notifications** — in-app inbox plus per-event toggles for email and WhatsApp preferences.
- **Profile & password** — manage your own account, change password, set notification preferences.

### For Faculty
- **Personalised dashboard** with a greeting, course count, this-week class count, and "awaiting your feedback" callout.
- **My courses** — see all courses you're assigned to, with their publish state.
- **This week** timeline — upcoming classes with day-of-month badges, room, course, and time.
- **Grading queue** — pending exam attempts (MCQ auto-graded; essays wait on your feedback).
- **Feedback authoring** — write rubric-based feedback with written comments, drafts save automatically, publish when ready.
- **Timetable view** filtered to your own classes.
- **Weekly digest email** every Monday morning summarising what's awaiting your feedback.

### For Finance
- **Dashboard** with a "Record payment" shortcut and collection totals.
- **Record a payment** — three-step flow: find student by name/email/code, confirm outstanding balance, record payment and issue a PDF receipt. The system applies the payment oldest-installment-first and creates a credit note for any overpayment.
- **Payment methods** supported: Cash, UPI, Bank Transfer, Cheque, Other.
- **Receipts** — every payment generates a PDF receipt with Indian locale amount-in-words and a sequential receipt code.
- **Reversal window** — payments can be reversed within 24 hours, producing a credit note.
- **Student search** — look up any student's fee position before recording.

### For Administration
- **Analytics dashboard** — live snapshot of the organisation:
  - Active students, suspensions, new admissions (this month / YTD)
  - Fees collected (this month / YTD), outstanding balance
  - SLA breaches (this week, broken down by ticket category)
  - Quiz and exam pass rates
  - Faculty feedback coverage (7-day rolling)
  - API spend for the month, by provider
  - 14-day trend sparklines on every headline number
- **Users** — list, filter by role, suspend/unsuspend, resend invites. Invite new users of any role via magic-link email.
- **Programs** — create and edit the catalogue.
- **Courses** — draft ↔ published lifecycle. Publishing creates an immutable version used by all enrolments.
- **Batches** — up to 30 students per batch. Start date, end date, capacity, coordinators.
- **Timetable builder** — weekly recurring slots per batch, with overlap detection across batch, faculty, and room. Supports cancel, reschedule, and one-off extra sessions.
- **Enrolments** — manage which student is in which batch, with validity dates. Trigger "Issue Certificate" on completion.
- **Tickets** — cross-organisation view with SLA breach filter and counter.
- **Audit log** — every staff write (payment recorded, user suspended, override applied, etc) is captured with actor, action, target, before/after, and timestamp.
- **Fee structures** — program-level templates with installment plans, weights (e.g. 40/30/30), and due-date rules.
- **Holidays** — holiday calendar that the timetable builder and business-day SLA clocks respect.

### For Super Admin
Everything Admin can see, with a **Read-only** pill in the top-right. Actions are disabled server-side as a safety measure.

---

## 3. What's Automated

The platform runs these tasks on its own — no one needs to press a button.

- **Fee reminders** — Daily at 8:30 AM IST. Sends reminders 14 days before due, 7 days before, on the due date, 3 days after, and again at 14 and 21 days overdue.
- **Auto-suspension** — Daily at 3:30 AM IST. Moves a student into "suspended" status if fees are 28 days overdue after two prior warnings. An admin can manually override.
- **SLA breach detection** — Every 15 minutes. Flags tickets that missed the 24-hour acknowledgement or 5-day resolution deadline (15 business days for Complaints). Breaches show up in the Admin dashboard and in the assignee's inbox.
- **Faculty weekly digest** — Monday 9:00 AM IST. Emails each faculty member a summary of essays awaiting grading and feedback drafts older than 7 days.
- **Notifications retry** — Every 15 minutes. Any email/WhatsApp that failed is retried up to 3 times over 24 hours.
- **Certificate issuance** — As soon as a student passes the final exam, a certificate is automatically issued and sent by email. No admin action required.

---

## 4. Integrations

The platform talks to other trusted services so information moves without copy-paste.

| Integration | Purpose | Current state |
|---|---|---|
| **Cloud Database (MongoDB Atlas)** | All student, course, payment, and ticket data | Live — cluster hosted in India (subject to region confirmation) |
| **Email delivery** | Invites, password resets, fee reminders, receipts, certificates | Staging uses a stub that logs to the server console. Production will use Resend (primary) with SendGrid or Brevo as fallback. |
| **File storage (Cloudinary)** | Course videos, PDF handouts, receipt PDFs, certificate artefacts | Staging uses a local stub. Cloudinary credentials required for production. |
| **WhatsApp (Meta Business API)** | Fee reminders, payment confirmations, ticket updates | Code is ready. Disabled until Meta approves the three message templates. |
| **Certificate provider (Certifier.io)** | Verifiable course-completion certificates | Code is ready. Disabled until the API key is provided; a placeholder URL is issued in the meantime. |
| **Error monitoring (Sentry)** | Automatic crash/error reporting | Ready — enabled when a DSN is configured. |
| **Payment gateway** | Online payment capture | Not in Phase 1 scope. Finance records manual payments (cash/UPI/bank/cheque). |

---

## 5. Security & Compliance

- **Indian data residency** — designed to be hosted in Mumbai (ap-south-1) to align with the **Digital Personal Data Protection Act 2023**.
- **Passwords** protected with modern hashing. Magic-link invites instead of emailed passwords.
- **Role-based access control** — every page and every action checks the signed-in user's role. Super Admin runs read-only as a safety net.
- **Refresh tokens** stored as secure HTTP-only cookies. Access tokens expire in 15 minutes; refresh tokens in 14 days.
- **Rate-limited sign-in** — repeated failures are throttled to blunt brute-force attempts.
- **Audit log** — every staff write is permanently recorded with who-did-what-when.
- **Encrypted transport (HTTPS)** end-to-end, with strict transport security.
- **Accessibility** — targets WCAG 2.1 AA. Keyboard navigation, visible focus rings, skip-to-content links, and screen-reader labels throughout.

---

## 6. Design & Experience

- **Single consistent brand** — navy and orange, logo on every screen, matching treatment across web and mobile.
- **Light animations** — subtle fade-in and hover lift on cards. Disabled automatically if the user's operating system has "reduce motion" enabled.
- **Mobile-responsive** — every page adapts to phone size without a separate app download. Navigation moves to a bottom tab bar on small screens.
- **Installable as a lightweight mobile app** via "Add to Home Screen" (planned for after staging; currently disabled while the design stabilises).
- **Indian locale throughout** — rupees formatted with the Indian digit grouping (`₹1,00,000`), dates in day-month-year order, times in Asia/Kolkata.

---

## 7. What's Shipping Next

- Live email delivery (Resend / SendGrid / Brevo)
- WhatsApp templates going live once Meta approves them
- Real certificate issuance via Certifier.io
- Cloudinary for media storage
- Production domain (e.g. `app.indialearns.com`)
- PWA mode re-enabled for installable-mobile experience
- Scoped analytics tiles for Finance and Faculty (today only Admin sees analytics)

All of the above are code-complete and feature-flagged off for staging. Flipping them on is a configuration step, not a build.

---

## 8. What to Try First

A suggested 10-minute tour:

1. Sign in as **Student** — see the dashboard hero, click into **My courses**, open the course detail, then **Timetable** and **Fees**.
2. Raise a test support ticket — **Tickets → New ticket** — and submit.
3. Sign out. Sign in as **Faculty** — see the courses you're assigned to and the week's classes.
4. Sign out. Sign in as **Finance** — open **Record payment**, search for a student, note the outstanding balance and the three-step flow.
5. Sign out. Sign in as **Super Admin** — open the **Analytics dashboard**, then **Users**, **Programs**, **Tickets**, and **Audit log**. Notice the **Read-only** badge top-right.

---

*Prepared for stakeholder review. This overview reflects the staging environment as of the date of sharing. Feedback welcome.*
