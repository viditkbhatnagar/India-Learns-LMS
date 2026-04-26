# ADR 0005 — Render cron instead of a queue

**Status:** Accepted
**Date:** 2026-02-20
**Author:** Vidit Bhatnagar

## Context

The platform has scheduled and asynchronous work:

- Daily fee reminders.
- Daily auto-suspension checks.
- Frequent SLA-timer ticks for tickets.
- Weekly faculty digests.
- Notification retries.

Three implementation patterns were on the table:

1. **Render cron jobs** — one job per schedule, each posts to a signed `/v1/jobs/*` endpoint.
2. **In-process scheduler** — node-cron or BullMQ inside the same process.
3. **Dedicated queue infra** — BullMQ + Redis + a worker dyno.

## Decision

Use **Render cron jobs** that POST to HMAC-signed endpoints in the API. Each cron is defined in [`render.yaml`](../../../render.yaml); each invocation runs `node scripts/sign-job-jwt.mjs <name>` which signs and POSTs the request. The API verifies the HMAC + 5-minute replay window via [`requireJobAuth`](../../../api/src/middleware/requireJobAuth.ts).

Five cron schedules in production today:

- `il-cron-fee-reminders` — daily 03:00 UTC.
- `il-cron-autosuspend` — daily 22:00 UTC.
- `il-cron-sla-timers` — every 15 minutes.
- `il-cron-faculty-digest` — Mon 03:30 UTC.
- `il-cron-notifications-retry` — every 15 minutes.

## Rationale

- **No new infrastructure.** Render's cron service is part of the same platform we already deploy on; no Redis to operate.
- **Signed endpoints.** Treating cron as just-another-API-caller means the same auth + audit + logging stack applies. Simple mental model.
- **Idempotent handlers.** Each cron handler is idempotent (we converge state, not push events). Replay-safe within the 5-minute window.
- **Visibility.** Cron failures show up in Render's UI alongside web service incidents.
- **Phase 1 volume is small.** A queue + worker is over-engineering at our scale.

## Consequences

**Good:**

- One deployment topology.
- One log stream.
- One auth model (HMAC, see [../security/cryptography.md](../../security/cryptography.md) §5).
- The web service can answer cron requests in milliseconds — no extra hop.

**Trade-offs:**

- Long-running jobs would block a request slot. We don't have any today; if we do, we'd switch to a queue.
- A single failed schedule means the task is delayed by one cycle; the retry cron compensates for transient failures, but a flat outage would need manual intervention.
- Rotating `JOB_SECRET` requires brief downtime because the current verifier accepts only one secret. Tracked as [../security/known-issues.md](../../security/known-issues.md) KI-008.

## Alternatives considered

- **In-process node-cron.** Acceptable but ties scheduling to one Node process. Render scaling would clone the schedule, leading to duplicate invocations.
- **BullMQ + Redis + worker.** Right answer for high volume / long jobs; wrong answer for our scale. Phase 2 candidate if/when justified.
- **GitHub Actions cron.** Doable, but mixes CI and runtime in a way that obscures responsibility.

## When to revisit

- We add a long-running job (> 30 seconds typical).
- Scheduled work crosses 1 invocation per minute per job.
- We want to retry-with-backoff for individual events rather than re-converging at the next tick.

## References

- [`render.yaml`](../../../render.yaml)
- [`api/src/middleware/requireJobAuth.ts`](../../../api/src/middleware/requireJobAuth.ts)
- [`scripts/sign-job-jwt.mjs`](../../../scripts/sign-job-jwt.mjs)
- [system-overview.md](../system-overview.md) §5
