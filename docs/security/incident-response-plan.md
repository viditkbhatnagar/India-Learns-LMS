# Incident Response Plan

This document is the playbook for what happens when something goes wrong — a confirmed security breach, a credible privacy incident, a major outage, or a high-severity production bug. It covers severity definitions, roles, detection and triage, the technical playbook, communications, regulatory clocks, and the post-mortem.

It is intended to be readable end-to-end in 10 minutes and re-readable mid-incident at 03:00.

## 1. Severity definitions

| Severity | Definition | Examples | Response target |
|---|---|---|---|
| **Sev 0** | Confirmed exposure of personal data, financial data, or auth credentials affecting one or more users; or production unreachable for > 30 minutes; or active exploitation in progress | Public dump of student records, attacker has admin access right now, Atlas cluster offline | **Immediate** — all hands |
| **Sev 1** | Strongly suspected breach, or high-impact functional failure that blocks a core flow | Suspect refresh-token reuse spike, fees module returning 500 in production, login broken for everyone | Within 1 hour |
| **Sev 2** | Localised security finding without confirmed exploitation, or significant degradation | Researcher reports a high-severity vulnerability, latency spike in a single role's flow | Within 4 hours (business hours) |
| **Sev 3** | Low-impact finding, single-user issue, planned-but-unannounced maintenance overrun | One student cannot log in due to a corner case, dependency CVE without exposure | Within 1 business day |

When in doubt, err one severity higher.

## 2. Roles during an incident

| Role | Default holder | Responsibility |
|---|---|---|
| **Incident Commander (IC)** | Vidit (vendor lead) | Owns the incident; decides severity, declares the start and the end. |
| **Tech lead** | Vidit (or designated) | Drives the technical investigation and remediation. |
| **Communications lead** | Vidit, escalating to Logan | Owns user-facing and regulator-facing communications. |
| **Scribe** | Tech lead delegate | Maintains the running incident timeline. |
| **LUC liaison** | Logan | Owns escalation into LUC leadership, finance team, and student communications. |

A single person can hold multiple roles during a small incident; for any Sev 0 they should be split.

## 3. Phases

### 3.1 Detect

Sources we watch:

- **Sentry** alerts to email (DSN-driven). New error groups in production trigger an email; spike thresholds default to 10 events / 5 min.
- **Render** alerts on deploy failures and `/healthz` failures.
- **Pino** structured logs in Render — accessible via `Logs` tab.
- **External vulnerability reports** to `{{SECURITY_EMAIL}}` per [SECURITY.md](SECURITY.md).
- **Operational signals** noticed by support staff (e.g., a student says they were logged in as someone else — this is a Sev 0 immediately).

### 3.2 Triage (first 15 minutes)

The IC assigns severity and confirms the report:

1. **Stop the bleed if possible.** If the incident is "attacker has admin access right now", revoke `JWT_SECRET` and force a redeploy (per [secrets-management.md](secrets-management.md) §4). If the incident is "wrong data shown to a user", do *not* yet roll back — first capture the page and HTTP response so you can reproduce later.
2. **Open a timeline.** Create a fresh document — use the format in §6. Every action gets a UTC timestamp.
3. **Pull a log slice.** Render → Logs → filter by request ID or by user. Save to the timeline.
4. **Decide if the situation requires user / regulator notification.** If yes, set the regulatory clock — see §5.

### 3.3 Contain

Goal: stop the harm without destroying the evidence.

- **Auth incident** — rotate `JWT_SECRET`, optionally `revokeAllForUser` or DB-wide refresh-token revoke. See [secrets-management.md](secrets-management.md) §4.1 + §5.
- **DB incident** — flip the affected role to `revoked` for affected users; close any active session via refresh-token revocation; optionally put the API into "read-only" mode by deploying a feature flag (manual today).
- **Provider incident** — toggle `INTEGRATIONS_MODE=stub` to disable a misbehaving integration; deploy.
- **Render service incident** — rollback to last good deploy if the issue was introduced by a release.

### 3.4 Eradicate

Make sure the cause cannot recur in the next minute:

- Patch the bug or vulnerability.
- Rotate any secret that may have been exposed.
- Remove malicious data (with audit).
- Unwind partial state (e.g., reverse mistaken payments via `paymentService.reversePayment`).

### 3.5 Recover

- Re-enable affected functionality.
- Bring traffic back if the service was offline.
- Notify affected users with the agreed message.
- Confirm `/healthz` and Sentry are quiet for 30 minutes.

### 3.6 Post-mortem

Within 5 business days of any Sev 0 or Sev 1, the IC publishes a blameless post-mortem in `/docs/post-mortems/YYYY-MM-DD-<slug>.md` (folder created on first occurrence). Required sections:

1. Summary (3–5 lines).
2. Timeline (UTC).
3. Impact (users affected, data accessed, money implicated, downtime minutes).
4. Root cause (technical and contributing factors).
5. What went well.
6. What went wrong.
7. Actions (with owners and dates), tracked in `TASKS.md`.

## 4. Communications tree

```
Incident detected
   ↓
   Vidit (IC) — within 5 min of detection
   ↓
   Logan (LUC technical owner) — within 30 min for Sev 0/1, within 2h for Sev 2
   ↓
   Rejin (LUC product owner) + LUC leadership — within 4h for Sev 0/1
   ↓
   Affected users — see §5 for timing
   ↓
   DPDP Board / regulator — see §5 for clock
```

Every external message must be approved by the IC before it goes out.

### 4.1 Communication templates

Stored in `/docs/templates/` once first written. The starter pair we always need:

- **Internal status update** — for LUC leadership and ops, every 30 min during a Sev 0/1.
- **User-facing notification** — short, factual, and in plain English. Names what happened, what data was involved, what we have done, what the user should do.

Do **not** speculate about cause or attribution in user-facing comms before the post-mortem.

## 5. Regulatory clock

### 5.1 DPDP Act 2023 — § 8(6)

If the incident constitutes a *personal data breach* — defined by the DPDP Act as any unauthorised processing of personal data, or accidental disclosure, acquisition, sharing, use, alteration, destruction or loss of access to personal data that compromises the confidentiality, integrity, or availability of personal data — we must:

- Notify the **Data Protection Board of India** "in such form and manner as may be prescribed" — guidance treats this as **without delay** with a working interpretation of **72 hours** in line with global norms.
- Notify each affected **Data Principal** in the same window.

Practically: from the moment the IC declares "this is a breach", the clock is running. Aim to notify within 72 hours and document any delay.

The notification must include:

- Nature of the breach.
- Categories and approximate number of affected data principals and records.
- Likely consequences.
- Measures taken or proposed.
- Contact point for further information (the DPO).

### 5.2 Other regimes

- **GDPR** — only relevant if EU/EEA data principals are affected. Same 72-hour clock applies.
- **Consumer protection / education regulators** — depends on jurisdiction and is handled by LUC legal.

## 6. Incident timeline format (copy-paste this when opening one)

```
# Incident YYYY-MM-DD-<slug>

Severity: <Sev 0 / 1 / 2 / 3>
IC: <name>
Tech lead: <name>
Comms: <name>
Scribe: <name>

## Timeline (UTC)

- 13:24 — Sentry alert: spike of 401 on /v1/auth/refresh
- 13:25 — IC declared, Sev 1 (provisional)
- 13:27 — Pulled logs for window 13:18–13:25 → see attachment
- 13:30 — Rotated JWT_SECRET, redeployed il-app
- ...

## Impact

- Users affected: <count>
- Data accessed: <description>
- Money implicated: <amount>
- Downtime: <minutes>

## Working hypothesis

<one paragraph>

## Actions taken

- <action> — <UTC time>
- <action> — <UTC time>

## Next steps

- <action> — <owner> — <due>
```

## 7. Specific playbooks (cheat sheet)

### 7.1 "Login is broken for everyone"

1. Check `/healthz` — if green, it's app-level not infra.
2. Render Logs → search `auth.login.failure` — look at `details.reason`.
3. If `unknown_user` is dominating: check Atlas connection (if Atlas is unreachable, `User.findOne` throws and login fails).
4. If `bad_password` is dominating: ask Logan whether a password-policy change shipped recently.
5. If JWT verification is failing on `/v1/auth/refresh`: someone may have rotated `JWT_SECRET` mid-session — accept the cost, redeploy, and email users to log in fresh.

### 7.2 "Suspected refresh-token theft"

1. Find the family: `db.refreshtokens.find({ userId: <id>, revokedAt: null })`.
2. Force-revoke the family by calling `revokeAllForUser` (or via admin endpoint once UI lands).
3. Force the user to reset their password.
4. Audit: `db.auditlogs.find({ targetType: 'User', targetId: <id> }).sort({ at: -1 })`.

### 7.3 "Atlas is down"

1. Confirm at https://status.cloud.mongodb.com/.
2. If regional, declare Sev 0; flip a feature-flag/banner if available; otherwise post a status to `{{WEBSITE_URL}}/status` (build pending).
3. Wait for Atlas to recover. Our app does not have a multi-region failover in Phase 1 — this is documented in [../operations/backup-and-dr.md](../operations/backup-and-dr.md).
4. Once recovered, watch `mongo.connected` Pino events for 10 minutes.

### 7.4 "A staff account was compromised"

1. Set the user's status to `revoked` (admin endpoint or direct DB write with audit).
2. `revokeAllForUser` to kill all sessions.
3. Force-rotate any secret that account had access to.
4. Audit-log review: `db.auditlogs.find({ actorUserId: <id>, at: { $gte: <suspected-start> } })`.

### 7.5 "WhatsApp messages going to the wrong number"

1. Toggle `WHATSAPP_ENABLED=false`, redeploy. The stub adapter logs but does not send.
2. Inspect the recent `whatsapp.send` calls in Pino logs for affected E.164 numbers.
3. Determine whether bad data (`User.phoneE164`) caused the misroute or a code bug.

## 8. References

- [SECURITY.md](SECURITY.md) — public reporting policy.
- [secrets-management.md](secrets-management.md) — rotation procedures.
- [../compliance/dpdp-compliance-report.md](../compliance/dpdp-compliance-report.md) — regulatory mapping.
- [../operations/on-call-runbook.md](../operations/on-call-runbook.md) — operational runbook for non-security incidents.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: every quarter and after every Sev 0 / Sev 1._
