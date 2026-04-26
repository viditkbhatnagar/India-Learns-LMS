# Student Handbook

Welcome to **India Learns**. This handbook walks you through every screen and feature available to students. Use it as a reference whenever something is unclear; the [FAQs](faqs.md) cover quick questions, and [support-channels.md](support-channels.md) explains how to get help.

> **Tip:** If you are new, the [Quick Start](quick-start-student.md) is a one-page version of this handbook covering the first day on the platform.

## 1. Getting started

### 1.1 Activating your account

When LUC enrols you, you'll receive an email titled "Welcome to India Learns — Activate your account". The email contains a magic link that's valid for **7 days**.

1. Click the link.
2. You'll land on the **Accept invite** screen. Set a password.
   - Minimum 10 characters.
   - At least one letter and one digit.
   - Don't reuse your last 3 passwords (if you've reset before).
3. You're signed in automatically. The first-time **Onboarding tour** introduces the platform in 5 short steps.

If the link expires, ask your admin to resend the invite.

### 1.2 Signing in

Future sign-ins go through `{{WEBSITE_URL}}/login`:

1. Enter your registered email and the password you set.
2. You're signed in for **15 minutes** of active use; the platform refreshes you automatically while you're active.
3. To sign out, use the avatar menu in the top right.

If you forget your password, click **Forgot password?** on the login screen. You'll receive an email with a reset link valid for **30 minutes**.

### 1.3 Password and account security

- Use a unique password — don't reuse it on other sites.
- After **10 wrong tries** in **15 minutes**, your account locks for 30 minutes.
- If you suspect someone has used your account, change your password immediately. This signs you out everywhere.

## 2. Your dashboard

`/student/dashboard` — your home page after login.

- **Welcome card** — your name, programme, batch.
- **Upcoming classes** — the next 3 classes from your timetable.
- **Pending tasks** — assignments due, quizzes you haven't started, exams scheduled.
- **Fees status** — outstanding amount and the next instalment due date.
- **Recent announcements** — the latest 5 from your enrolled courses.
- **Notifications bell** (top right) — unread notifications count.

## 3. Courses

### 3.1 Browse your courses

`/student/courses` — every course you're currently enrolled in.

Each card shows:

- Course title and code.
- Programme it belongs to.
- Faculty assigned.
- A progress bar (modules completed / total).

Click a card to open the **Course detail** page.

### 3.2 Course detail

`/student/courses/:courseId`

Tabs:

- **Overview** — course description, learning outcomes, faculty bio.
- **Modules** — the structured content. Each module has sessions, materials, assignments.
- **Sessions** — scheduled class sessions for the course.
- **Materials** — downloadable readings, slide decks, links.
- **Announcements** — anything the faculty posts to the whole class.
- **Assignments** — your assignment list with due dates and submission status.

### 3.3 Modules and sessions

Open a module to see its sessions in order. A session may include:

- A description / objective.
- Slide decks or PDF materials (downloadable).
- Linked assignments.
- A schedule (date and time, IST).

You don't need to "tick off" a session — there's no watch-time tracking. Your progress is measured by completed assessments and attended classes (the latter is recorded by your faculty in person).

### 3.4 Materials

PDF and slide decks open in a viewer. Use the download icon to keep a copy for offline study. Course videos (when available) play inline; the platform does not track watch-time.

### 3.5 Announcements

Read-only feed of messages from your faculty or admin. Important announcements also generate notifications and (if enabled) emails.

## 4. Timetable

`/student/timetable`

- **Weekly view** — your default. Shows recurring classes per weekday.
- **Day view** — useful on mobile.
- **Override indicators** — if a class is rescheduled or cancelled (e.g., a holiday), the entry shows the change clearly.
- **Holiday markers** — days marked as holidays show no classes.

When the timetable changes, you receive a notification (and email/WhatsApp if enabled).

## 5. Quizzes and exams

### 5.1 Quizzes

Quizzes are short multiple-choice assessments tied to a module or session. To take one:

1. From the course or module page, click the quiz title.
2. The attempt screen displays the questions.
3. Submit when done. Your score appears immediately.
4. Some quizzes allow multiple attempts; the rules are stated on each quiz.

### 5.2 Exams

Final exams may include both MCQ and essay sections.

1. Open the exam from your course at the scheduled time.
2. Answer the MCQ section (auto-graded) and write the essay section (manually graded).
3. Submit before the timer ends.
4. Your faculty grades the essay portion. You'll be notified when results are published.

### 5.3 Assignments

Assignments are uploaded by your faculty within a session.

1. Open the assignment, read the brief.
2. Submit your answer (file upload, link, or text).
3. Your status moves from "Not submitted" → "Submitted" → "Graded" once the faculty publishes the grade.

You only see published grades and feedback. Drafts are private to faculty.

## 6. Fees

### 6.1 Your fees page

`/student/fees`

Shows:

- **Outstanding amount** in ₹.
- **Instalments** — each instalment with its due date and current status (paid, partially paid, overdue).
- **Payment history** — every recorded payment with date, method, reference.
- **Receipts** — download links for issued PDF receipts.

### 6.2 Recording a payment

Payments are made offline (bank transfer, UPI, cash, cheque, etc.) and **recorded by LUC's finance team**, not by you. Once recorded, the payment shows up here within a few minutes and the receipt becomes downloadable.

### 6.3 Late payments

If an instalment is overdue, you'll receive reminder notifications. If dues remain unpaid past the cure period, your account enters a **fees-suspended** state:

- You can still log in.
- You can see your fees, your dashboard, your notifications, your past certificates, and the Finance ticket category.
- Other features are temporarily restricted until the dues are paid.
- Once finance records your payment that brings the balance below the threshold, the suspension lifts automatically.

If you need to negotiate a payment plan, raise a Finance ticket — see §8.

## 7. Certificates

`/student/certificates`

- After you complete all required coursework and pass all required assessments, and once your fees are settled, the platform issues a digital diploma.
- Certificates appear on this page with a public verification URL.
- You can share the URL with employers — they'll see your name, course, and completion date.
- Past certificates remain visible even if your account is later fees-suspended (you should be able to show prior credentials at any time).

## 8. Tickets and support

### 8.1 Raising a ticket

`/student/tickets/new`

Choose a category:

- **Academic** — questions about course content, schedule, faculty.
- **Administrative** — programme, batch, enrolment changes.
- **Finance** — fees, payments, refunds, instalment plans.
- **Technical** — login problems, the platform isn't working.
- **Complaints** — formal grievance. _Note: a Complaint can only be raised after a related Resolved/Closed ticket — if you haven't tried the regular ticket route, do that first._

Fill in:

- Subject (one line).
- Description (be specific).
- Optional file attachments.

### 8.2 Tracking a ticket

`/student/tickets`

You'll see all your tickets with status:

- **Open** — newly raised, not yet acknowledged.
- **In progress** — staff are working on it.
- **Resolved** — staff believes it's done; you have **15 days** to confirm or reopen.
- **Closed** — finalised.

Open any ticket to read the thread, add a comment, or reopen if needed.

### 8.3 SLAs

Staff aim to:

- **Acknowledge** within **24 hours** of you raising the ticket.
- **Resolve** within **5 working days** for most categories.
- **Resolve** within **15 working days** for Complaints.

If a ticket exceeds these targets, the system flags it for admin attention.

## 9. Feedback

`/student/feedback`

Faculty may run feedback surveys for a course, an instructor, an assessment, or a session. When they do, the survey appears here. Your responses are confidential — instructors see aggregated results, not who said what.

You can also submit unsolicited feedback for a course you've completed.

## 10. Profile and notifications

### 10.1 Your profile

`/profile`

Edit:

- Name (visible to faculty/admin).
- Phone number (E.164 format).
- Address.

You cannot change your email or programme/batch from here — open a ticket for those.

### 10.2 Notification preferences

`/profile/notifications`

Per category (timetable, fees, tickets, certificates, announcements), toggle:

- Email notifications.
- WhatsApp notifications (when enabled by LUC).

In-app notifications (the bell icon) are always on for important events.

### 10.3 Logout

Use the avatar menu → Sign out. If you suspect compromise, change your password instead — that signs you out of all devices.

## 11. PWA — installing on your phone

India Learns is a Progressive Web App. To install:

- **Android Chrome** — browse to `{{WEBSITE_URL}}`, tap the menu, choose "Install app".
- **iOS Safari** — tap Share → "Add to Home Screen".

Once installed, the app behaves like a native app: a splash screen, full-screen mode, and basic offline access to previously viewed content. Sign in still requires network.

## 12. Privacy and your rights

Your data is processed under our [Privacy Policy](../legal/privacy-policy.md) in line with the **Digital Personal Data Protection Act, 2023** of India. You have the right to:

- Access a summary of your data.
- Correct inaccurate data.
- Request erasure (subject to statutory retention).
- Withdraw consent for non-essential notifications.
- Raise a grievance with our DPO.

To exercise any of these, raise a ticket with category **Administrative** and subject `[DSAR]`, or email `{{DPO_EMAIL}}`. We respond within **15 working days**. Detail in [../compliance/dsar-procedure.md](../compliance/dsar-procedure.md).

## 13. Common issues

| If… | Try this |
|---|---|
| You can't log in | Check the email is the one LUC has on file. Try password reset. If still failing, raise a Technical ticket. |
| Your invite link doesn't work | Likely expired (7 days). Ask your admin to resend. |
| You don't see a course you should be in | Open an Administrative ticket; admin can correct the enrolment. |
| The timetable shows the wrong time | Times are shown in IST. If still off, open a Technical ticket with a screenshot. |
| A class was cancelled but the timetable still shows it | The override hasn't been applied yet. Open an Administrative ticket. |
| You paid fees but they don't show | Finance records payments manually after receipt. Wait 24 hours; then open a Finance ticket with the payment proof. |
| The platform feels slow | Check your internet. The app works offline for previously viewed content; switching networks helps. If persistent, open a Technical ticket. |

## 14. Where to go next

- [FAQs](faqs.md) — quick questions across categories.
- [Support channels](support-channels.md) — how to escalate when tickets aren't enough.
- [Privacy Policy](../legal/privacy-policy.md) — the full data-handling notice.
- [Terms of Service](../legal/terms-of-service.md) — the rules you agreed to at signup.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with Rejin (LUC operations). Review cadence: per release._
