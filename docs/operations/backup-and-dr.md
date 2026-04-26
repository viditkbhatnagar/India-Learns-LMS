# Backup and Disaster Recovery

How India Learns protects its data against loss and how it returns to service after a disaster. Read together with [slas.md](slas.md) (which sets the RPO/RTO targets) and [../security/incident-response-plan.md](../security/incident-response-plan.md) (which governs incident handling).

## 1. What is backed up

| Data | Backup mechanism | Location | Retention |
|---|---|---|---|
| MongoDB Atlas (production cluster, all 39 collections) | Atlas continuous backup + scheduled snapshots | Atlas-managed (Mumbai region) | Continuous: ~24h; Daily snapshots: 30 days |
| Cloudinary assets (receipts, materials, attachments) | Provider durability — Cloudinary stores at S3 multi-AZ behind the scenes | Cloudinary cloud | Indefinite while account active |
| Source code | GitHub remote + every developer's local clones | GitHub | Indefinite |
| Render service config | `render.yaml` checked into git; secrets in Render secret group `il-app-secrets` | GitHub + Render | Indefinite |

The application database is the single most important backup target. Everything else is recoverable from source or the provider's own resilience.

## 2. RPO and RTO targets

From [slas.md](slas.md):

- **RPO (max acceptable data loss):** 6 hours.
- **RTO (max time to restore):** 4 hours for app-level issues, 24 hours for full-cluster restore.

Atlas continuous backup gives us an effective RPO close to 0 in routine conditions; the 6-hour target is a buffer for non-routine incidents.

## 3. Restore scenarios

### 3.1 Single record recovery

A user reports they lost data — for example, an admin accidentally deleted a fee instalment.

1. Open Atlas → Backup → Continuous Backup.
2. Pick a point in time before the deletion.
3. Use the Atlas "Query a backup" feature to read the missing document.
4. Manually re-insert into the live cluster.
5. Audit-log the recovery (`admin.direct_db_write`) per [../user-guides/superadmin-handbook.md](../user-guides/superadmin-handbook.md) §7.

Time: typically under 30 minutes.

### 3.2 Collection-level recovery

A data-loss incident affects an entire collection.

1. Open Atlas → Backup → Restore → choose snapshot.
2. Restore to a new cluster (don't overwrite production directly).
3. Inspect the restored data.
4. Selectively copy back to the live cluster.
5. Validate with smoke tests.

Time: 1–4 hours depending on data size.

### 3.3 Full-cluster restore

The production cluster is unrecoverable.

1. Atlas → Restore → choose snapshot → restore to a fresh cluster in the same region.
2. Update `MONGODB_URI` in Render secret group `il-app-secrets` to point at the new cluster.
3. Redeploy `il-app`.
4. Verify `/healthz` and a smoke flow (login as a test user, list courses).
5. Run the cron jobs once manually to confirm.
6. Inform users that data ≤ 6 hours old may be missing.

Time: target 24 hours; faster if Atlas snapshot is fresh.

### 3.4 Region-level outage

Atlas Mumbai region is offline.

This is **not currently mitigated** beyond Atlas's own redundancy within the region. We do not run a multi-region cluster in Phase 1 because:

- Cost increase is significant.
- Phase 1 user base is small.
- Atlas's own SLAs cover regional resilience.

Phase 2 candidate: cross-region read replica with manual failover.

If a regional outage occurs, post a status update and wait for Atlas. Communicate per [../security/incident-response-plan.md](../security/incident-response-plan.md) §4.

### 3.5 Cloudinary outage

Receipts, materials, and ticket attachments cannot be downloaded.

- The platform continues to operate; only download links fail.
- Wait for Cloudinary to recover.
- The DB still has the metadata (URLs, keys). Once Cloudinary is back, downloads work again.
- If extended, switch the storage adapter to `stub` temporarily to allow new uploads to proceed against an in-memory cache (data lost on restart) — this is a deliberate decision the IC takes per [../security/incident-response-plan.md](../security/incident-response-plan.md) §3.3.

### 3.6 Email provider outage

Notifications fail to send.

- The application continues; users see in-app notifications.
- The notifications-retry cron (`il-cron-notifications-retry`, every 15 min) re-tries failed sends.
- If the primary fails repeatedly, set `EMAIL_PROVIDER` to the next available provider in the secret group + redeploy.
- SendGrid is the configured fallback when primary is Resend or Brevo (see [../security/secrets-management.md](../security/secrets-management.md)).

## 4. Restore drill

We conduct a restore drill **quarterly** against staging. The drill is the only way to know recovery actually works.

### 4.1 Drill plan

1. Schedule a 2-hour window outside of UAT activity.
2. Pick a snapshot at least 7 days old.
3. Restore to a fresh staging cluster.
4. Update `MONGODB_URI` of staging to the restored cluster.
5. Run the smoke checklist:
   - `/healthz` returns ok.
   - Login as a UAT student succeeds.
   - List enrolled courses — expected items present.
   - Record a payment (against a sandbox student) — receipt generated.
   - Audit-log search returns recent entries.
6. Compare row counts against the live cluster (allowing for the 7-day delta).
7. Restore staging to its normal connection string.
8. Document timing in `docs/post-mortems/restore-drill-YYYY-MM-DD.md` (folder created on first drill).

### 4.2 Drill outputs

- Time to restore (start to validation pass).
- Issues encountered.
- Confirmation that the snapshot was usable.
- Any RTO/RPO target adjustments suggested.

### 4.3 Status

As of 26 April 2026, **no restore drill has been executed**. Closing this gap is a pre-launch requirement — see [../compliance/soc2-readiness-gap-analysis.md](../compliance/soc2-readiness-gap-analysis.md) row A1.3.

## 5. Erasure and backups

Backups taken before an erasure request still contain the erased data. Backups roll off after 30 days at the Atlas Standard plan level. We inform Data Principals of this when fulfilling erasure — see [../compliance/dsar-procedure.md](../compliance/dsar-procedure.md) §7.

## 6. Configuration recovery

If the Render service or its config is lost:

1. Re-import `render.yaml` from git into a fresh Render account / blueprint.
2. Re-create the secret group `il-app-secrets` and populate from the secrets vault.
3. Redeploy.
4. Smoke-test.

This is a one-day exercise but documented at [../../DEPLOY.md](../../DEPLOY.md) and [../../claude-code-docs/05_Deployment_Runbook.md](../../claude-code-docs/05_Deployment_Runbook.md).

## 7. Cross-references

- [slas.md](slas.md) — RPO/RTO targets.
- [monitoring-and-alerting.md](monitoring-and-alerting.md) — what triggers a recovery scenario.
- [on-call-runbook.md](on-call-runbook.md) — operational playbooks during recovery.
- [../security/incident-response-plan.md](../security/incident-response-plan.md) — incident framework.
- [../compliance/data-retention-policy.md](../compliance/data-retention-policy.md) — retention and deletion rules.

_Last reviewed: 2026-04-26 — Owner: Vidit Bhatnagar. Review cadence: per quarter + after every drill._
