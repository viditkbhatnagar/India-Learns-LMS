import { retryFailedNotifications, type RetrySweepResult } from '../services/notificationService.js';
import { nowUtc } from '../services/clockService.js';
import { recordAudit } from '../services/auditService.js';

// M8 cron: /v1/jobs/notifications-retry (every 15 min per D-068). Sweeps
// notifications that failed in the last 24h (window + max attempts come from
// env, see notificationService.retryFailedNotifications). Idempotent — the
// retryCount + lastRetryAt fields on each document prevent repeated dispatch
// within the backoff window.
export async function runNotificationsRetryJob(): Promise<RetrySweepResult> {
  const result = await retryFailedNotifications({ now: nowUtc() });
  await recordAudit({
    actorUserId: null,
    action: 'jobs.notifications_retry.invoked',
    targetType: 'System',
    targetId: null,
    details: {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    },
  });
  return result;
}
