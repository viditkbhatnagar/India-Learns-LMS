# ADR 0007 — MongoDB Atlas, Mumbai region

**Status:** Accepted
**Date:** 2026-02-01
**Author:** Vidit Bhatnagar (with LUC)

## Context

The application database holds personal data of Indian students. We had to pick:

1. **Database engine.** MongoDB vs. PostgreSQL.
2. **Hosting model.** Self-hosted vs. managed.
3. **Region.** India vs. nearest neighbour vs. global.

All three have privacy, latency, and operational consequences.

## Decision

- **Engine:** MongoDB 7 (via Mongoose 8).
- **Hosting:** MongoDB Atlas (managed).
- **Region:** AWS `ap-south-1` (Mumbai).

## Rationale

### Why MongoDB

- The domain has many semi-structured records (course content, ticket comments, audit before/after diffs) where flexible schemas help.
- Mongoose ODM is mature and matches the team's familiarity.
- Tested patterns exist for the operational primitives we need (TTL indices, partial indices, atomic findOneAndUpdate for the refresh-token race, change streams if we ever need them).

A relational store would also work. Choosing one over the other for this scope is a wash; we picked MongoDB for team comfort and the schema flexibility on audit/before-after blobs.

### Why Atlas

- Managed encryption at rest with KMS-backed keys.
- Automated continuous backup with point-in-time recovery.
- SOC 2 / ISO 27001 attestations — important for the [SOC 2 readiness](../../compliance/soc2-readiness-gap-analysis.md) story.
- One vendor handles patching, replicas, scaling.
- We don't have the operational headcount to babysit a self-hosted cluster.

### Why Mumbai (`ap-south-1`)

- **DPDP Act § 16 alignment.** Indian data resident in India avoids cross-border-transfer scrutiny entirely for the database — the most sensitive store. Subprocessors can transfer data abroad, but the system of record stays in India.
- **Low latency** — Render's Singapore region (closest available) and Atlas Mumbai are ~20 ms apart. The application Node process and the DB are not co-region but they're closer than e.g. Render Singapore + Atlas US-East.
- **Government and regulator preference.** When the DPDP Rules notify, "where do you store the data" is one of the first questions; "Mumbai" is the simplest answer.

## Consequences

**Good:**

- Privacy posture is straightforward to articulate to LUC, regulators, and B2B clients.
- Backup, encryption, and replication are vendor-managed.
- One Atlas project = one billing line.

**Trade-offs:**

- Render's Singapore region adds ~20 ms of latency to every DB call vs. an in-region app server. Acceptable; we are well within p95 targets ([../operations/slas.md](../../operations/slas.md) §3).
- Single-region cluster = no automatic regional failover. Mitigated by Atlas's intra-region replica set; the next maturity step would be a cross-region read replica with manual cutover. See [../operations/backup-and-dr.md](../../operations/backup-and-dr.md) §3.4.
- Atlas costs scale with cluster size; we use Standard tier for Phase 1.

## Alternatives considered

- **Atlas in Frankfurt or Singapore.** Lower latency to Render but adds DPDP cross-border friction.
- **Self-hosted on AWS Mumbai.** More control, more work; not a fit for our team size.
- **Postgres + Prisma.** Different DX and different schema discipline; viable, but it would have been chosen mainly out of preference rather than because Mongo couldn't serve.

## References

- [`render.yaml`](../../../render.yaml) — secret group `il-app-secrets` carries `MONGODB_URI`.
- [`api/src/config/db.ts`](../../../api/src/config/db.ts) — connection wiring.
- [../compliance/dpdp-compliance-report.md](../../compliance/dpdp-compliance-report.md) §1 (§16 cross-border)
- [../compliance/vendor-risk-register.md](../../compliance/vendor-risk-register.md) V1
