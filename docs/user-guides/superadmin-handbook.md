# Superadmin Handbook

The superadmin role exists for two readers: the **vendor lead** (Vidit) and a **single LUC operator** designated by Logan. It carries every admin capability plus a small set of system-critical powers that should be exercised rarely.

> **Tip:** Read [admin-handbook.md](admin-handbook.md) first — superadmin is admin + extras. This handbook covers only the extras.

## 1. Why this role is special

Superadmin is the only role that can:

- Promote other users to admin / finance / faculty / superadmin (or demote them).
- Permanently hard-delete a user (rather than soft-delete with the 90-day undo).
- Override the audit-log retention (only by direct DB action; there is no UI).
- Toggle integration mode (e.g., `WHATSAPP_ENABLED`) — actually requires a Render env change, but superadmin makes the operational decision.
- Re-import curriculum on production data — wrong import order can damage course state, so superadmin gate is by design.

Because of this, **superadmin actions warrant heightened audit attention**. Use [`/admin/audit-logs`](#) regularly.

## 2. Daily / weekly habits

### 2.1 Daily (5 min)

- Glance at `/admin/dashboard` for SLA breaches and outstanding fees.
- Skim `/admin/audit-logs` for unusual activity in the last 24 hours.
- Confirm `/healthz` returns `ok: true` from your browser.

### 2.2 Weekly (15 min)

- Check the weekly faculty digest cron ran (Mon 03:30 UTC = 09:00 IST). Quick spot-check by asking a faculty.
- Review `/admin/tickets/sla-breaches` for any aged > 5 days.
- Review the audit log for `user.role_changed` events — there should rarely be any.
- Read [../security/known-issues.md](../security/known-issues.md) — does anything need attention?

### 2.3 Monthly

- Run the dependency-update review per [../security/secure-sdlc.md](../security/secure-sdlc.md) §6.
- Refresh the [vendor risk register](../compliance/vendor-risk-register.md) entry for any subprocessor that had an incident or DPA renewal.
- Review [TASKS.md](../../TASKS.md) and decide what gets pulled in this month.

### 2.4 Quarterly

- Run the retention sweep per [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md) §3.2 (manual until automation lands).
- Refresh the [SOC 2 readiness gap analysis](../compliance/soc2-readiness-gap-analysis.md) and update statuses.
- Read [../security/threat-model.md](../security/threat-model.md) and assess if anything in the residual list needs action.

## 3. Role assignment

### 3.1 Promote a user

`/admin/users/:id` → click **Change role**:

1. Pick the new role.
2. Provide a reason (free text).
3. Confirm — an audit row `user.role_changed` is written.

The user keeps their existing sessions; their next access-token refresh picks up the new role.

### 3.2 Demote a user

Same flow. Best practice: communicate first, document the reason, then demote.

### 3.3 Removing the last superadmin

There must be at least one superadmin at all times. The UI prevents demoting the only superadmin. To replace yourself, promote the next person first, then demote.

## 4. Hard delete a user

This is destructive. Use only when:

- A user explicitly requests erasure under DPDP § 12 and statutory retention does not apply.
- A regulator requires removal.
- A user was created in error and has no statutory artefacts (no payments, no certificates).

Before hard-delete:

1. Confirm via [../compliance/dsar-procedure.md](../compliance/dsar-procedure.md) that erasure is appropriate.
2. Run the export so the principal has a copy.
3. Ensure no statutory holds (litigation, regulatory enquiry).
4. Then delete.

After hard-delete:

- `User` row removed.
- Linked enrolments / submissions / tickets are anonymised (where retained for statutory reasons) or removed.
- Cloudinary assets linked to the user are deleted.
- Audit rows about the user are anonymised per [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md) §4.1.
- Backup snapshots up to **30 days** old still contain the user; the principal is informed.

## 5. Curriculum import on production

`/admin/curriculum-import` runs against production data. The platform now dedupes step10/step11/step12 and auto-recovers partial state, so re-imports are safe — but always **Preview** before **Run**.

If a re-import is needed because a previous one was corrupted, contact Vidit before running on production; some failure modes need a code-side investigation first.

## 6. Operational toggles

Phase-1 toggles live as Render env vars in `il-app-secrets`. Changing one requires a Render redeploy.

| Toggle | What it controls |
|---|---|
| `INTEGRATIONS_MODE` | `stub` overrides every integration to console adapters; useful for incident isolation |
| `WHATSAPP_ENABLED` | `true` to enable Meta WABA; default `false` (console stub) |
| `CERTIFIER_ENABLED` | `true` to issue real certificates; default `false` (deterministic stub URLs) |
| `EMAIL_PROVIDER` | `resend\|sendgrid\|brevo\|stub` — primary email |
| `STORAGE_PROVIDER` | `cloudinary\|stub` |
| `RATE_LIMITS_DISABLED` | **MUST be `false` in production**. Test-only |
| `LOG_LEVEL` | Lower (e.g., `debug`) during incidents to gather signal |
| `SENTRY_TRACES_SAMPLE_RATE` | Adjust for incident telemetry (max 1.0) |

Always note the change in `TASKS.md` so other operators know the active configuration.

## 7. Direct DB access (Atlas)

Vidit has Atlas console access. Logan has DB-user-only access (no UI access).

Direct DB writes:

- **Should be avoided.** Use admin endpoints whenever possible.
- **Must be audit-logged manually** if undertaken — write a row to `auditlogs` with `actorUserId: <your id>`, `action: 'admin.direct_db_write'`, free-text `details` describing what and why.
- **Should be reviewed.** Take a screenshot of the query and result; share with the other superadmin within 24 hours.

The DB user is application-scoped; you connect with a separate read-write user that is logged in Atlas's own audit trail.

## 8. Incident response

You are likely the incident commander for any Sev 0 or Sev 1. Read [../security/incident-response-plan.md](../security/incident-response-plan.md) before you need it. Highlights:

- Severity matrix in §1.
- 5-step playbook in §3.
- Communications tree in §4.
- 72-hour DPDP breach notification clock in §5.1.
- Cheat-sheet playbooks in §7 for common cases.

## 9. Onboarding a new admin

1. Confirm with Logan / LUC that the new admin has been authorised and has a NDA / employment contract.
2. Invite via `/admin/users` with role `admin`.
3. Once they accept, run them through this handbook + [admin-handbook.md](admin-handbook.md).
4. Pair on a real ticket triage session.
5. Watch their first week's audit log for unusual patterns.

## 10. Offboarding a staff member

1. Set status to `revoked` in `/admin/users/:id`.
2. Confirm `revokeAllForUser` was triggered (it is — every status change to revoked triggers it).
3. If they had access to provider consoles (Cloudinary, Resend), rotate those keys per [../security/secrets-management.md](../security/secrets-management.md) §4.
4. Note the offboarding in `TASKS.md` so audit reviewers can correlate.

## 11. Common cross-role escalations

| Situation | Action |
|---|---|
| Admin can't suspend a user | Either you or the user already changed the status; refresh both pages. |
| Faculty disputes a published grade | Pull `audit-logs` filtered by the assignment id; show before/after. |
| Finance disputes a payment record | Same — pull the `payment.recorded` and `payment.reversed` audit entries. |
| A student claims they never received an invite | Check `auth.password_reset_requested` (analogous flow). If no email events, the email vendor may have bounced — check Resend / SendGrid logs. |
| LUC asks for a list of all current students | Export from the admin users page filtered by role=student, status=active. The export is logged. |

## 12. Where to go next

- [Admin handbook](admin-handbook.md) — your bread and butter.
- [Operations runbook](../operations/on-call-runbook.md) — when something is broken.
- [Threat model](../security/threat-model.md) — what we're defending against.
- [DPDP compliance report](../compliance/dpdp-compliance-report.md) — the regulatory view.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per release + on every superadmin onboarding._
