# Service-Level Commitments

The service-level targets for India Learns Phase 1, framed as commitments to LUC. These are not contractual until accepted in a separate written agreement; they are the operational targets the team manages against.

## 1. Scope

Covered:

- The web service `il-app` on Render (Singapore region).
- The five cron jobs.
- The MongoDB Atlas cluster (Mumbai, ap-south-1) at the level of "the application can read and write".

Not covered:

- Subprocessor outages (Cloudinary, Resend, Meta WhatsApp, Certifier, Sentry) — when a subprocessor is down, only the dependent feature degrades. Each subprocessor's SLA applies to itself; we monitor and communicate but do not promise remedy beyond best-effort failover.
- Render or Atlas regional outages.

## 2. Availability

| Metric | Target | Measurement |
|---|---|---|
| Service availability — `/healthz` 200 | **99.5%** monthly | External uptime check (BetterStack / UptimeRobot) — 1-minute interval |
| Planned-maintenance allowance | Up to **4 hours / month**, announced ≥ 24 hours in advance | Excluded from availability calculation |
| Unplanned downtime allowance under target | ~3.6 hours / month | Counted toward target |

99.5% is the right target for a Phase 1 single-region deployment. We will revisit when Phase 2 brings multi-region failover.

## 3. Performance

| Metric | Target | Notes |
|---|---|---|
| API p95 response time (excluding cron) | **< 500 ms** | Render dashboard and Sentry traces |
| API p99 response time | **< 1500 ms** | Same |
| Web TTI on a typical 3G connection | **< 3 seconds** | Lighthouse CI run periodically |
| Login flow end-to-end | **< 2 seconds** | Includes Argon2 verify + JWT issuance |

These targets are aspirational at Phase 1 scale (≤ 30 students per class, ≤ 1000 concurrent for the projected ramp). Re-baseline after the first full cohort.

## 4. Operations response

| Severity | First response | Update cadence | Resolution target |
|---|---|---|---|
| **Sev 0** (data exposure / outage > 30 min) | < 15 min | Every 30 min | Best-effort, no fixed target |
| **Sev 1** (high-impact functional break) | < 1 hour | Hourly | Same business day where feasible |
| **Sev 2** (localised security or feature finding) | < 4 business hours | Daily | < 5 business days |
| **Sev 3** (low-impact issue) | < 1 business day | As progressed | < 30 days |

Severity definitions live in [../security/incident-response-plan.md](../security/incident-response-plan.md) §1.

## 5. Ticket SLAs

These are the SLAs for **support tickets** raised via the platform — not the same as operational severities above.

| Category | Acknowledge | Resolve |
|---|---|---|
| Academic | 24 hours | 5 working days |
| Administrative | 24 hours | 5 working days |
| Finance | 24 hours | 5 working days |
| Technical | 24 hours | 5 working days |
| **Complaints** | 24 hours | **15 working days** |

A working day is Mon–Fri, 09:00–18:00 IST, excluding LUC holidays.

## 6. Recovery

| Metric | Target |
|---|---|
| RPO — recovery point objective (max acceptable data loss) | **6 hours** (Atlas continuous backup-derived) |
| RTO — recovery time objective (max time to restore from a recoverable failure) | **4 hours** for app-level issues; **24 hours** for full-cluster restore |
| Restore-drill cadence | **Quarterly** against staging |

See [backup-and-dr.md](backup-and-dr.md) for the procedure.

## 7. Communication

When a Sev 0 or Sev 1 incident is in progress:

- A banner in the app (when possible).
- A status email to LUC operations and to affected users.
- Updates per the cadence in §4.

Routine maintenance windows are announced ≥ 24 hours in advance via email + in-app notice. Maintenance is scheduled outside core class hours where possible.

## 8. Reporting

A monthly operations report summarises:

- Availability against target.
- Sev 0 / Sev 1 incidents and post-mortems.
- Ticket SLA performance.
- Subprocessor incidents that affected India Learns.
- Outstanding gaps from [../compliance/soc2-readiness-gap-analysis.md](../compliance/soc2-readiness-gap-analysis.md).

## 9. What's excluded

- Force-majeure events (acts of God, government action, major regional infrastructure failure).
- Security incidents whose containment requires deliberate downtime.
- Customer-induced outages (e.g., LUC requests a deploy during peak hours).

## 10. Review

Targets are reviewed quarterly and after every Sev 0. Increases (looser targets) are agreed with LUC; decreases (tighter targets) are decisions for the operations team based on capacity.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: quarterly._
