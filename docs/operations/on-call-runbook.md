# On-Call Runbook

The operational playbook for keeping India Learns running. This **extends** [../../claude-code-docs/05_Deployment_Runbook.md](../../claude-code-docs/05_Deployment_Runbook.md) (which covers the initial Render setup) — it does not replace it. Read both.

## 1. On-call roster

Phase 1 operates with a small primary + secondary model:

- **Primary on-call:** Vidit Bhatnagar (vendor lead) — for technical incidents, deploys, security.
- **Secondary on-call:** Logan (LUC technical owner) — for LUC-side decisions, user-facing comms approval, escalation.
- **Communications:** Logan + Rejin — student-facing messages.

There is no formal pager rotation in Phase 1. Email and direct contact are the primary alerts. Phase 2 introduces PagerDuty / OpsGenie.

## 2. Escalation tree

```
Detection (Sentry / Render / Pino / user report)
    ↓
   Vidit (primary on-call)
    ↓ if not reached within 15 min for Sev 0/1
   Logan (secondary)
    ↓ if not reached within 30 min for Sev 0
   Rejin + LUC leadership
    ↓ for student communications
   Affected users + (per [../security/incident-response-plan.md](../security/incident-response-plan.md) §5) regulator
```

## 3. First 15 minutes

For any alert that looks Sev 0 or Sev 1:

1. **Acknowledge.** Reply to the alert (or post in Slack when available) so others know it's seen.
2. **Read the signal.** Sentry error group / Pino logs / Atlas alert.
3. **Check `/healthz`.** Confirm the service is up.
4. **Open the [incident-response timeline](../security/incident-response-plan.md) §6.** Start writing UTC entries.
5. **Decide severity.** When in doubt, go higher.

## 4. Per-alert playbooks

These are the recurring scenarios. Match the symptom, follow the steps, and escalate if the playbook doesn't resolve.

### 4.1 "Service is down" (`/healthz` failing)

Symptoms: external uptime check fires, Render service page shows "Build failed" or "Crashed".

1. Render dashboard → `il-app` → Logs.
2. Recent deploy that failed?
   - **Yes** → roll back to the previous deploy (Render → Deploys → previous → Redeploy).
3. No recent deploy?
   - Check Render service status (Render itself may be incidented).
   - Check Atlas — if the app can't connect, the service may crash on boot. Render keeps the previous instance running until the new one passes health checks, but `autoDeploy` may have replaced it.
4. If still down after 5 minutes, declare Sev 0 per [../security/incident-response-plan.md](../security/incident-response-plan.md).

### 4.2 "Login is broken for everyone"

See [../security/incident-response-plan.md](../security/incident-response-plan.md) §7.1 for the full playbook.

### 4.3 "Atlas connection errors in logs"

Symptoms: `mongo.connection.error` log lines, 500s on routes that touch the DB.

1. Atlas → Cluster → check status.
2. Check Atlas's status page for regional incidents.
3. If `MONGODB_URI` was just rotated, confirm the rotation completed end-to-end (Atlas user changed + Render env updated + service redeployed).
4. If Atlas-side issue, wait for Atlas + post status to LUC.
5. If app-side, restart the Render service (Manual deploy → re-deploy current).

### 4.4 "Suspected refresh-token theft"

See [../security/incident-response-plan.md](../security/incident-response-plan.md) §7.2.

### 4.5 "Cron job hasn't run"

Symptoms: no `job.<name>.success` log line at the expected time.

1. Render → cron service → Logs. Was the run attempted?
2. If yes but failed: read the error. Common cases:
   - 401 from `/v1/jobs/*` — `JOB_SECRET` mismatch. Check both web service and cron secret group.
   - 500 from the handler — code bug. Read the stack, file an issue, fix.
3. If no — Render may have skipped the schedule. Manually trigger the cron from the Render UI if available; otherwise wait for the next scheduled run.
4. If repeated misses, declare Sev 2.

### 4.6 "Notifications not sending"

Symptoms: `email.send` failures in logs, students reporting they didn't receive expected emails.

1. Confirm provider status (Resend / SendGrid / Brevo status page).
2. Check `EMAIL_PROVIDER` env — is the right one selected?
3. Check API key validity (rotate if compromised).
4. If primary is failing, the platform should fall back to SendGrid automatically when configured. Confirm by reading the cost ledger or logs (you'll see two cost rows when fallback wins).
5. The retry cron (`il-cron-notifications-retry`) catches transient failures — wait for it.

### 4.7 "WhatsApp messages going to the wrong number"

See [../security/incident-response-plan.md](../security/incident-response-plan.md) §7.5.

### 4.8 "Receipt PDF won't download"

Symptoms: Cloudinary signed URL returns 401 or 404; user reports.

1. Check Cloudinary status page.
2. Verify the receipt's storage key still exists (Cloudinary Media Library → search by public_id).
3. If the asset is missing, check `audit_logs` for recent `storage.delete` events.
4. If the URL is expired, mint a fresh signed URL via the API (the platform does this automatically on click, so a stale URL points to UI caching).

### 4.9 "User locked out and can't reset"

Symptoms: user reports they can't log in even after waiting the 30-minute lockout.

1. Check `audit_logs` for `auth.login.failure` for that email.
2. If `loginFailCount` is stuck at the lockout threshold, manually clear it:
   - From Atlas Data Explorer or via a small script.
   - Set `loginFailCount: 0`, `lockedUntil: null`.
3. Walk the user through password reset.
4. Note: if compromise is suspected, do NOT clear; instead, force a password reset via the admin UI.

### 4.10 "I shipped a regression"

1. Roll back via Render → previous deploy → Redeploy.
2. Open an incident timeline.
3. File a bug + write a test that pins the regression.
4. Post a brief retrospective in the next session memory file ([CLAUDE.md](../../CLAUDE.md) §10).

## 5. Acceptance criteria for "incident over"

An incident is over when:

- The originating signal has stopped (Sentry quiet, `/healthz` green, audit-log normal).
- We've watched for 30 minutes after the apparent fix and seen no recurrence.
- LUC has been informed (for Sev 0 and Sev 1).
- A timeline + post-mortem are scheduled within the SLA (5 business days for Sev 0/1).

## 6. Useful one-liners

```bash
# Tail the last 200 production logs (run from a machine with Render CLI auth)
render logs il-app --tail --num 200

# Check `/healthz` from outside
curl -s https://il-app.onrender.com/healthz | jq

# Find recent audit entries for a user
# (in Atlas Data Explorer or Compass)
db.auditlogs.find({ targetId: ObjectId("...") }).sort({ at: -1 }).limit(50)

# Find recent failed login attempts
db.auditlogs.find({ action: "auth.login.failure" }).sort({ at: -1 }).limit(50)

# Force-revoke all refresh tokens for a user
db.refreshtokens.updateMany(
  { userId: ObjectId("..."), revokedAt: null },
  { $set: { revokedAt: new Date() } }
)
```

## 7. After every incident

- Write the post-mortem within 5 business days of Sev 0/1 (or 10 days for Sev 2). Folder: `/docs/post-mortems/YYYY-MM-DD-<slug>.md`.
- Update [../security/known-issues.md](../security/known-issues.md) if a residual risk is now confirmed.
- Update this runbook if a new playbook entry would help next time.
- Add follow-up tasks to `TASKS.md`.

## 8. Cross-references

- [slas.md](slas.md) — the targets we're operating against.
- [monitoring-and-alerting.md](monitoring-and-alerting.md) — where the signals come from.
- [backup-and-dr.md](backup-and-dr.md) — restore procedures.
- [../security/incident-response-plan.md](../security/incident-response-plan.md) — the broader incident framework.
- [../security/secrets-management.md](../security/secrets-management.md) — for secret rotations during incidents.
- [../../claude-code-docs/05_Deployment_Runbook.md](../../claude-code-docs/05_Deployment_Runbook.md) — initial setup; this doc extends it.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per quarter + after every Sev 0/1._
