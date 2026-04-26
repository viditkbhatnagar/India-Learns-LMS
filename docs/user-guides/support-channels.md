# Support Channels

How to get help on India Learns: where to ask, how to phrase the request, and how long it should take to hear back.

## 1. Channel ladder

Use the lowest channel that fits your problem. Escalate only if it doesn't get traction.

```
Self-serve  →  In-app ticket  →  Email  →  WhatsApp (if enabled)  →  Phone  →  Regulator
   ↓               ↓                ↓             ↓                    ↓        ↓
  FAQs +       primary route       backup     informal nudge     emergency   formal
  handbook    for everyone                    only            only          grievance
```

| Channel | Best for | Response |
|---|---|---|
| **FAQs / handbooks** | Quick how-to | Instant — `docs/user-guides/` |
| **In-app ticket** | Most issues — anything that needs a record | Acknowledge ≤24h; resolve ≤5 working days |
| **Email** ({{SUPPORT_EMAIL}}) | If you can't sign in to raise a ticket | Same SLAs as ticket; staff usually convert it into a ticket |
| **WhatsApp** | Only if your account uses WhatsApp notifications and the issue is urgent timetable / fees | Best-effort; not a primary support channel |
| **Phone** | Active emergency (e.g., locked out on the day of an exam) | Best-effort; provided to LUC staff only |
| **Regulator** | Formal grievance escalation | Per DPDP § 13 process |

## 2. Choosing a ticket category

| Category | Use it when |
|---|---|
| **Academic** | Course content, faculty, schedule clarification, exam disputes |
| **Administrative** | Enrolment, batch, programme, profile fields you can't edit yourself, DSAR requests |
| **Finance** | Fees, payments, refunds, receipts, instalment plans |
| **Technical** | Login issues, app errors, anything broken |
| **Complaints** | Formal grievance — only after a regular ticket on the same topic has been Resolved/Closed |

The platform routes the ticket to the right team automatically based on category. You can re-categorise later if needed.

## 3. Writing a great ticket

A specific ticket gets resolved faster than a vague one.

**Do**

- One issue per ticket.
- Include screenshots when relevant (the platform supports attachments).
- Mention the URL where it happened.
- Include the timestamp (your time + IST if known) so we can find logs.
- Tell us what you expected vs what you saw.

**Don't**

- Don't share passwords. We'll never ask for them.
- Don't paste full screen recordings unless asked — short videos help; long ones distract.
- Don't include other students' personal data; redact when necessary.

### Template

```
Subject: <one-line>
Where: <URL or screen>
What I did: <steps>
What I expected: <expected outcome>
What I saw: <actual outcome>
When: <date + time, IST>
```

## 4. SLAs

The platform tracks two clocks per ticket:

- **Acknowledgement** — staff has read it and is working on it. Target: **24 hours** (business hours).
- **Resolution** — staff has either fixed it or explained the resolution. Target: **5 working days** for most categories; **15 working days** for Complaints.

If a target is missed, the ticket is flagged on the SLA-breaches dashboard for admin attention. You can also escalate by adding a comment.

## 5. Escalation paths

### 5.1 Within India Learns

1. Add a comment on your existing ticket asking for escalation.
2. If still no movement after another 5 working days, raise a **Complaints**-category ticket (only possible if you have a prior Resolved/Closed ticket on the same topic).
3. The Complaints SLA is 15 working days and is owned by senior staff.

### 5.2 To LUC

For matters outside the platform's remit (programme delivery, faculty conduct, refunds beyond policy), LUC operations has direct channels at LUC's offices.

### 5.3 To the Data Protection Board

If your concern is about how India Learns or LUC handles your personal data and you are not satisfied with our response:

- Contact our DPO at **{{DPO_EMAIL}}**.
- If still unresolved, you may complain to the **Data Protection Board of India**. Procedural details: [../compliance/dpdp-compliance-report.md](../compliance/dpdp-compliance-report.md).

## 6. What we will and won't do

**We will:**

- Treat every request with confidentiality.
- Reply within stated SLAs.
- Investigate to the depth the issue warrants.
- Provide a clear written resolution.

**We won't:**

- Ask for your password.
- Share another user's information with you.
- Edit a record without an audit trail.
- Bypass the platform to "do you a favour" — every action is recorded.

## 7. Outage and incident communications

When the platform has an incident affecting many users:

- A banner appears in the app (when possible).
- An email goes out to affected users (when not possible).
- Status updates appear at `{{WEBSITE_URL}}/status` once the status page is provisioned.
- The Incident Commander updates per [../security/incident-response-plan.md](../security/incident-response-plan.md) §4.

Do not raise tickets during a known outage — wait for the resolution comms. Tickets clog the queue and delay other resolutions.

## 8. Languages

Phase 1 supports **English** only. We aim to add Hindi in Phase 2 — see [../compliance/accessibility-statement.md](../compliance/accessibility-statement.md) §Languages.

## 9. Contact summary

| Channel | Address |
|---|---|
| In-app | `/student/tickets/new` (or `/staff/tickets` for staff) |
| Email — general | {{SUPPORT_EMAIL}} |
| Email — privacy/DPO | {{DPO_EMAIL}} |
| Email — security | (per [../security/SECURITY.md](../security/SECURITY.md)) |
| Postal | {{ORG_REGISTERED_ADDRESS}} |

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar with Rejin (LUC operations). Review cadence: per release._
