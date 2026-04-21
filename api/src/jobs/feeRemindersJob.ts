import type { FeeReminderJobResult } from 'india-learns-shared-types';
import { recordAudit } from '../services/auditService.js';
import { run } from '../services/feeReminderService.js';

export async function runFeeRemindersJob(): Promise<FeeReminderJobResult> {
  const result = await run();
  await recordAudit({
    actorUserId: null,
    action: 'jobs.fee_reminders.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      processed: result.processed,
      notificationsEnqueued: result.notificationsEnqueued,
      skipped: result.skipped,
      errorCount: result.errors.length,
    },
  });
  return result;
}
