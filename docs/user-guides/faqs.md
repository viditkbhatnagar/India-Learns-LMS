# Frequently Asked Questions

Quick answers across all roles. For full context, follow the link at the end of each answer.

## Account and login

**Q: I didn't get my invitation email.**
Check spam. If still missing, ask your admin to resend. The invite is sent from `notifications@indialearns.app`.

**Q: My invitation link doesn't work.**
Magic-link invitations expire after 7 days. Ask your admin to resend.

**Q: I forgot my password.**
Click **Forgot password?** on the login screen. The reset email arrives within a minute and the link is valid for 30 minutes.

**Q: Why is my account locked?**
After 10 wrong password attempts in 15 minutes, the account locks for 30 minutes. Wait, then try again — or use Forgot Password to skip the wait.

**Q: How do I sign out everywhere?**
Change your password. That revokes all your sessions on every device.

**Q: Can I share my account with a family member?**
No. Sharing accounts is a breach of the [Acceptable Use Policy](../legal/acceptable-use-policy.md).

## Courses and timetable

**Q: I don't see a course I should be enrolled in.**
Open an **Administrative** ticket. Admin will fix the enrolment.

**Q: The timetable shows a class at the wrong time.**
All times are in IST (Asia/Kolkata). If still wrong, open a Technical ticket with a screenshot.

**Q: A class was cancelled but the timetable still shows it.**
Admin needs to add a timetable override. Open an Administrative ticket; or wait — admins typically push overrides the same day.

**Q: Are course videos tracked?**
No. India Learns does not track watch-time, scroll position, or per-page views. Progress is measured by completed assessments and faculty-recorded attendance.

## Assessments

**Q: I missed an exam.**
Contact your faculty (Academic ticket). Re-take rules vary per programme.

**Q: When will I see my grade?**
Quizzes: immediately (auto-graded). Assignments and exams (essay): after your faculty publishes the grade. You only see published grades.

**Q: I disagree with a grade.**
Discuss with your faculty first. If unresolved, open an Academic ticket.

## Fees

**Q: How do I pay my fees?**
Payments are made offline (bank transfer, UPI, cash, cheque). LUC's finance team records them on the platform. Once recorded, you'll see the payment and a downloadable receipt.

**Q: I paid but it doesn't show up.**
Wait 24 hours — finance records manually. Then open a Finance ticket with the bank reference.

**Q: I'm fees-suspended. What can I do?**
You can still log in. Visit your Fees page, the dashboard, your notifications, or open a Finance-category ticket. Other features unlock once your dues are paid.

**Q: Can I get a refund?**
Refer to the [Refund Policy](../legal/refund-policy.md). Open a Finance ticket with subject `[Refund]`.

**Q: Where's the GSTIN on my receipt?**
At the top of the PDF. The GSTIN belongs to {{ORG_NAME}}. If it's missing or wrong, open a Finance ticket.

## Certificates

**Q: When will I get my certificate?**
After completing all coursework, passing all assessments, and clearing fees. The platform checks the conditions automatically and issues the certificate.

**Q: Can employers verify my certificate?**
Yes. The certificate page shows a public verification URL. Share that URL.

**Q: My certificate has the wrong name.**
Open an Administrative ticket. We'll correct your profile and re-issue the certificate.

## Tickets and support

**Q: How do I raise a ticket?**
Sign in → Tickets → New ticket. Pick a category, write a clear subject and description, attach files if helpful.

**Q: What's the SLA?**
Most categories: acknowledge within 24h, resolve within 5 working days. Complaints: 15 working days.

**Q: My ticket has been "Resolved" but I don't agree.**
You have 15 days to reopen. Click **Reopen** on the ticket page and add a comment explaining.

**Q: How do I raise a Complaint?**
Complaints have stricter rules. You can only raise one if a related ticket has already been Resolved or Closed. Use the Administrative or Academic categories first.

## Privacy

**Q: How do I see what data India Learns has about me?**
Raise an Administrative ticket with subject `[DSAR]`. We respond within 15 working days. Detail in [../compliance/dsar-procedure.md](../compliance/dsar-procedure.md).

**Q: How do I delete my account?**
Same channel — `[DSAR]` ticket with the request. Note that financial records are retained for 8 years for tax purposes; we anonymise rather than hard-delete those.

**Q: I don't want WhatsApp messages.**
Open `/profile/notifications`, toggle off WhatsApp. You can do this per category.

**Q: Are my exam answers visible to anyone?**
Only your faculty and admin (for grading and audit). Other students never see them.

## Technical

**Q: The platform is slow.**
Try a different network. The PWA caches static content for offline use, but live data needs network. If consistently slow, open a Technical ticket.

**Q: The platform shows "You're offline".**
Either you actually are, or a stale cached service worker is interfering. Reload the page; the platform automatically replaces stale workers.

**Q: I can't install the PWA.**
Use Chrome on Android or Safari on iOS. Browse to `{{WEBSITE_URL}}` and use the browser's "Add to Home Screen" / "Install app".

**Q: Which browsers are supported?**
Recent Chrome, Safari, Firefox, Edge (last two major versions). IE 11 is not supported.

## Staff-specific

**Q: (Faculty) The "Mark complete" button is disabled.**
Save attendance for at least one student first. Tooltip on the button explains.

**Q: (Faculty) I can't drag a session.**
Auto-generated sessions (from curriculum import) have drag disabled. Re-import the source to fix.

**Q: (Admin) An invite was issued but not accepted.**
The link is valid for 7 days. Click **Resend invite** on the user's detail page to issue a fresh link.

**Q: (Finance) I recorded the wrong amount.**
Reverse the payment (with a reason) and re-record. Don't try to edit — that breaks the audit trail.

**Q: (Superadmin) I want to demote myself.**
Promote someone else first. The platform prevents you from being the last superadmin if you try to demote yourself.

## Operational

**Q: When are scheduled maintenance windows?**
Communicated by email at least 24 hours in advance for planned changes. Emergency maintenance is announced as soon as the IC declares the incident — see [../security/incident-response-plan.md](../security/incident-response-plan.md).

**Q: What's the uptime target?**
99.5% per [../operations/slas.md](../operations/slas.md). We don't guarantee 100%; planned and unplanned downtime may occur.

**Q: How do I report a security issue?**
See [../security/SECURITY.md](../security/SECURITY.md). Authorised researchers are covered by safe-harbor language.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with Rejin (LUC operations). Review cadence: per release; immediate review on any new common question._
