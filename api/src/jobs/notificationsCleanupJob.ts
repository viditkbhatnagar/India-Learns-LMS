import {
  cleanupOldNotifications,
  type CleanupSweepResult,
} from '../services/notificationService.js';
import { nowUtc } from '../services/clockService.js';
import { recordAudit } from '../services/auditService.js';

// Q-M4-03 cron: /v1/jobs/notifications-cleanup. Nightly retention sweep
// that bulk-deletes read notifications older than NOTIFICATIONS_READ_RETAIN_DAYS
// (90d default) and unread notifications older than NOTIFICATIONS_UNREAD_RETAIN_DAYS
// (365d default). Idempotent — re-running in the same minute is a no-op
// since the cutoff is computed from `now`.
export async function runNotificationsCleanupJob(): Promise<CleanupSweepResult> {
  const result = await cleanupOldNotifications({ now: nowUtc() });
  await recordAudit({
    actorUserId: null,
    action: 'jobs.notifications_cleanup.invoked',
    targetType: 'System',
    targetId: null,
    details: {
      readDeleted: result.readDeleted,
      unreadDeleted: result.unreadDeleted,
      readCutoff: result.cutoffs.read.toISOString(),
      unreadCutoff: result.cutoffs.unread.toISOString(),
    },
  });
  return result;
}
