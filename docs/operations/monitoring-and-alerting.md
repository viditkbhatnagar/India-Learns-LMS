# Monitoring and Alerting

What we observe, where the signals come from, and what triggers a human response.

## 1. Signal sources

| Source | What it tells us | Where to look |
|---|---|---|
| **Render dashboard** | Service up/down, deploy status, restart events, CPU/memory | render.com → `il-app` |
| **`/healthz` endpoint** | Liveness — service is up and can reach Atlas | External uptime monitor (BetterStack / UptimeRobot — to be configured) |
| **Pino structured logs** | Per-request structured logs, request IDs, custom events (e.g. `audit.write_failed`, `email.send`) | Render Logs tab |
| **Sentry — server SDK** | Unhandled errors and selected performance traces from the API | Sentry project for the API |
| **Sentry — web SDK** | Uncaught errors and user-facing perf traces from the SPA | Sentry project for the web |
| **Audit log** | Every staff write — useful for retro-investigations | `/admin/audit-logs` |
| **Cron job logs** | Each of the 5 crons logs success / failure | Render → cron service Logs |
| **Atlas alerts** | DB-level alerts (slow queries, replication lag, disk pressure) | Atlas → Alerts |
| **Provider status pages** | When subprocessor outages affect features | provider docs |

## 2. Key health signals

### 2.1 Liveness

`/healthz` returns:

```json
{ "ok": true, "commit": "<sha>", "uptimeSec": <int>, "ts": "<ISO-8601>" }
```

- 200 + `ok: true` — service is up. Atlas connection is implied because routes that require it would fail to respond otherwise (the endpoint itself is light, but the same process serves DB-bound routes).
- Non-200 — service is down or unhealthy.

Hook this into BetterStack / UptimeRobot at 1-minute frequency from at least two regions.

### 2.2 Error rate

A spike in `auth.login.failure`, 5xx responses, or new Sentry error groups indicates a problem.

- Sentry's default email alert fires when a new error group appears in production. Tune thresholds per group.
- Pino logs have request IDs — use them to follow a single request across log lines.

### 2.3 Cron freshness

Each cron should log success at its scheduled cadence:

| Cron | Frequency | Log signal |
|---|---|---|
| `il-cron-fee-reminders` | Daily 03:00 UTC | `job.fee_reminders.success` |
| `il-cron-autosuspend` | Daily 22:00 UTC | `job.autosuspend.success` |
| `il-cron-sla-timers` | Every 15 min | `job.sla_timers.success` |
| `il-cron-faculty-digest` | Mon 03:30 UTC | `job.faculty_digest.success` |
| `il-cron-notifications-retry` | Every 15 min | `job.notifications_retry.success` |

If we don't see the success log for >2× the schedule period, alert.

### 2.4 Audit-write failures

`audit.write_failed` Pino events indicate the AuditLog collection is unreachable. Audit failures don't fail the request, so this is only visible in logs. Should be **zero** in steady state; any occurrence is a Sev 2.

### 2.5 Subprocessor failures

Each integration logs failures:

- Email: `email.send` failure with provider error code.
- WhatsApp: `whatsapp.sendTemplate` failure.
- Storage: `storage.upload` / `storage.delete` failure.
- Certifier: `certificate.issue` failure.

Sustained failure (e.g., 5 consecutive errors in 10 minutes) → Sev 2.

## 3. Alert routing

Currently:

- **Sentry email alerts** → Vidit's email.
- **Atlas alerts** → Vidit's email.
- **Render alerts** → Vidit's email.
- **Uptime monitor** → not yet wired.

Phase 2 candidates:

- PagerDuty / OpsGenie for off-hours paging.
- Slack channel for medium-severity events.
- LUC liaison email for incidents that affect students.

The email funnel is acceptable for Phase 1's user base. As we approach launch, decide on a richer routing scheme.

## 4. Dashboards (what to keep open)

In a daily check-in (5 min):

1. Render service status — green.
2. `/healthz` — manual hit.
3. Sentry events in last 24h — sort by frequency; investigate any new groups.
4. Atlas → Performance Advisor — any slow query that stands out.
5. Render cron services — last successful run timestamps.

## 5. Custom metrics (Phase 2)

Today, we don't push custom metrics (counters, gauges, histograms) anywhere. Sentry traces and Pino logs cover the immediate need. When we want richer graphs (e.g., login attempts per minute by status), we have two options:

- Stream Pino logs to a log aggregator (Datadog, Logtail).
- Add a metrics exporter (StatsD / Prometheus) and a small dashboard.

Both are Phase 2. Either is fine; the choice depends on what an operator wants to look at.

## 6. SLO budgets

We don't formally track SLO error budgets in Phase 1. Targets in [slas.md](slas.md) are managed against by gut + Render dashboard. Formalising error budgets is a Phase 2 maturity step.

## 7. What to do when alerted

- **Page-worthy** (Sev 0/1) → run [../security/incident-response-plan.md](../security/incident-response-plan.md).
- **Sev 2/3** → triage in business hours; open a `TASKS.md` entry.
- **Subprocessor outage** → confirm at the provider's status page; toggle to fallback if available; communicate to LUC.
- **Cron silent** → check the cron service logs; if last invoke shows 401 or 500, the secret may have rotated out of sync ([../security/secrets-management.md](../security/secrets-management.md) §4.2); if quiet, Render may have skipped the schedule — re-run manually.

## 8. Logs vs metrics vs traces

| Use | Best signal |
|---|---|
| "What happened around 14:23?" | Pino logs filtered by request ID + time |
| "Is this a new error?" | Sentry — group view |
| "How many login failures today?" | Pino, grep `auth.login.failure` |
| "Why is this single request slow?" | Sentry trace if sampled |
| "How is the DB doing?" | Atlas Performance Advisor + Slow Query Log |

Pick the signal that matches the question; don't try to answer everything from one source.

## 9. Status communication

For incidents affecting users:

- A banner in the app (when possible).
- Email to LUC ops + affected users.
- Public status page at `{{WEBSITE_URL}}/status` (planned — not yet provisioned).

The IC owns external comms per [../security/incident-response-plan.md](../security/incident-response-plan.md) §4.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: quarterly + after every Sev 0._
