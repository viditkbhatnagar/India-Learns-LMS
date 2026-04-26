# Faculty Handbook

This handbook walks you through everything you need to teach effectively on India Learns: managing your courses, taking attendance, grading, publishing announcements, and viewing student feedback.

> **Tip:** [Quick Start (staff)](quick-start-staff.md) is the one-page version.

## 1. Sign-in

### 1.1 First time

You'll receive a "Welcome to India Learns — Activate your account" email. Click the magic link, set a password, and you're in. The link is valid for **7 days**.

Password rules: 10+ characters, at least one letter and one digit, not one of your last three passwords.

### 1.2 Daily

Sign in at `{{WEBSITE_URL}}/login`. After **10 wrong tries** in 15 minutes, your account is locked for 30 minutes. If that happens, wait or use **Forgot password?**.

## 2. Faculty dashboard

`/faculty/dashboard`

Cards on the dashboard:

- **My courses** — number of courses assigned to you this term.
- **Today's classes** — sessions on your timetable for today.
- **Grading backlog** — submissions and exam attempts waiting for your grade.
- **Recent feedback** — published feedback from students on your courses.
- **Announcements** — your most recent posts.

## 3. My courses

### 3.1 List

`/faculty/courses` — every course assigned to you.

Each card shows:

- Course title and programme.
- Enrolment count.
- Number of upcoming sessions.

Click to enter the **course shell**.

### 3.2 The course shell

`/courses/:id/overview` (and the tabs `/content`, `/gradebook`)

The shared shell has three tabs:

#### Overview

Course metadata, description, learning outcomes. Click **Edit** to update.

#### Content

The structural view — modules, sessions inside each module, materials, assignments.

- **Re-order sessions** by drag-and-drop. Sessions auto-renumber.
- **Move a session across modules** by dragging it into a different module. The source module compacts.
- **Auto-generated sessions** (from curriculum import) have their drag handle disabled — re-importing the source corrects the structure.
- **Click into a session** to see its detail page (see §4).

#### Gradebook

Matrix of students × graded items. Each cell shows the published score, or one of:

- **"To grade"** — submission exists, awaiting grade.
- **"Missing"** — no submission yet.
- **"Draft"** — graded but not published.
- **"Excused"** — explicitly excused.

Click an assignment column header to enter the **per-assignment grading view**.

## 4. Session detail

When you click a session in the Content tab:

- **Left column** (2/3 width)
  - Title, description, scheduled start/end (IST).
  - Linked materials — slides, PDFs, links.
  - Linked assignments.
- **Right column** (1/3 width)
  - **Attendance** — toggle each student between Present / Absent / Late. Click **Save attendance**.
  - **Private notes** — your notes on the session, invisible to students.

### 4.1 Marking a session complete

The **Mark complete** button is disabled until you've saved attendance for at least one student. After clicking:

- The session is marked complete.
- The button changes to **Undo complete**, available for **7 days**.
- An audit log entry `session.completed` is written.

### 4.2 Editing materials and assignments

Use the inline edit affordances on each material or assignment. Removing a material does **not** delete files attached to past student submissions.

## 5. Assignments

### 5.1 Per-assignment grading

`/courses/:id/assignments/:assignmentId/grading`

Filter chips at the top:

- **All** — every enrolled student.
- **Submitted** — has submitted.
- **Needs grading** — submitted, no draft / published grade.
- **Drafts** — has a draft grade.
- **Published** — final grade published.
- **Missing** — no submission.

For each row, you can:

- Open the submission.
- Apply rubric scoring.
- Write feedback.
- **Save draft** — score is private to faculty.
- **Publish** — score becomes visible to the student.

### 5.2 Two-step publish

The two-step process lets you grade without students seeing partial work:

1. **Save as draft** — score stored but hidden from student.
2. **Publish** — score becomes visible.

Once published, you can update or unpublish, but the audit log records every change.

## 6. Quizzes (auto-graded)

Quizzes are MCQ. They're created at the course level; faculty grade nothing — the system auto-scores. You can review aggregate performance from the gradebook.

## 7. Exams

Exams may include MCQ + essay sections.

- MCQ is auto-scored.
- Essay sections appear in your **grading queue** at `/faculty/grading`.

### 7.1 Grading an essay

1. From `/faculty/grading`, click an attempt.
2. Read the essay text.
3. Apply rubric scoring + free-text feedback.
4. Save draft or Publish (same two-step pattern as assignments).

## 8. Feedback

### 8.1 Creating a survey

`/faculty/feedback/new`

- Choose the target — a course, an instructor, an assessment, or a session.
- Pick a rubric (numeric scales) + add free-text questions.
- Choose the audience (which enrolment).
- Schedule when responses close.

### 8.2 Reviewing responses

`/faculty/feedback`

You see aggregated results — average scores per scale, anonymised free-text responses. Individual respondents are not shown to you (this protects student honesty).

## 9. Timetable

`/faculty/timetable`

- Your personal teaching schedule across all assigned courses.
- Read-only — admin builds the timetable.
- If you spot a conflict or error, raise an Administrative ticket.

## 10. Announcements

From any course's **Content** tab, click **Add announcement**. Write the message and publish. Students enrolled in that course see it on their dashboard, and (if their preferences allow) by email.

You cannot delete announcements students have already seen — instead, post a follow-up correcting the message.

## 11. Tickets — your inbox

When you handle student tickets:

- `/staff/tickets` shows tickets routed to you (typically Academic-category tickets for your courses).
- Use the comment area to communicate.
- Mark **Internal** to write notes other staff see but the student doesn't.
- Transition the state: **Acknowledge** → **In progress** → **Resolved** (or **Closed** for spam / out-of-scope).

## 12. Profile and notifications

`/profile` — edit your name, phone, and address.

`/profile/notifications` — toggle email and WhatsApp by category.

## 13. Common issues

| If… | Try this |
|---|---|
| A student isn't on the gradebook | Check the enrolment is active in `/admin/enrollments` (admin only). Open an Administrative ticket if you can't access. |
| Drag-and-drop is not working on a session | The session is auto-generated from curriculum import; re-import the source to correct. |
| Mark-complete is disabled | Save attendance for at least one student first. |
| You don't see a course you teach | Course assignment is admin-managed. Open an Administrative ticket. |
| Grading queue feels stale | Refresh; the queue updates when students submit. |
| You want to revoke a published grade | You can re-publish a corrected grade; the audit log records every revision. |

## 14. Privacy notes

- Student attempts and submissions are sensitive — don't copy text out of the platform.
- Free-text feedback from students should be aggregated; don't quote individuals to other students.
- See [../compliance/data-classification.md](../compliance/data-classification.md) for the full handling guide.

## 15. Where to go next

- [FAQs](faqs.md) — quick questions across roles.
- [Support channels](support-channels.md) — escalation paths.
- [Admin handbook](admin-handbook.md) — for admin tasks if you have admin powers too.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with LUC academic team. Review cadence: per release._
