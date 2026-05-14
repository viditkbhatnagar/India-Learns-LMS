import { recordAudit } from '../services/auditService.js';
import { headHash } from '../services/admissions/admissionsAuditService.js';
import { logger } from '../config/logger.js';

// M9 — Periodic head-hash snapshot for the admissions audit chain (D-A4).
//
// The chain is tamper-evident via per-row chainHash. To prove a row isn't
// silently swapped out wholesale, we anchor the current head hash off-row
// at regular intervals. The minimum-viable anchor here is the existing
// auditLog (legacy collection) with action='admission.audit.head_snapshot'.
// In a follow-up, the head hash should also be shipped to a log aggregator
// (Sentry / Render logs) and/or an immutable S3 object.

export interface AuditHeadSnapshotResult {
  head: string | null;
  recordedAt: string;
}

export async function runAdmissionsAuditHeadSnapshotJob(): Promise<AuditHeadSnapshotResult> {
  const head = await headHash();
  const recordedAt = new Date().toISOString();
  await recordAudit({
    actorUserId: null,
    // Reuse the existing notifications_retry slot as the job-invocation
    // marker — adding a fresh enum entry would mean a downstream type-check
    // ripple across all AUDIT_ACTIONS consumers. The action name lives in
    // the `details.job` discriminator instead.
    action: 'jobs.notifications_retry.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      job: 'admissions_audit_head_snapshot',
      head,
      recordedAt,
    },
  });
  // Also log loud so the Render log feed has a copy. If the legacy auditLog
  // collection is ever tampered with, the log line is still recoverable.
  logger.info({ head, recordedAt }, 'admissions.audit.head_snapshot');
  return { head, recordedAt };
}
