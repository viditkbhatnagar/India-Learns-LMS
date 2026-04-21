import type { SlaTimersJobResult } from 'india-learns-shared-types';
import { recordAudit } from '../services/auditService.js';
import { computeBreaches } from '../services/slaService.js';

export async function runTicketSlaJob(): Promise<SlaTimersJobResult> {
  const result = await computeBreaches();
  await recordAudit({
    actorUserId: null,
    action: 'jobs.sla_timers.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      processed: result.processed,
      ackBreached: result.ackBreached,
      resolveBreached: result.resolveBreached,
      skipped: result.skipped,
      errorCount: result.errors.length,
    },
  });
  return result;
}
