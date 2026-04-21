import type { AutoSuspendJobResult } from 'india-learns-shared-types';
import { recordAudit } from '../services/auditService.js';
import { autoSuspendRun } from '../services/suspensionService.js';

export async function runAutoSuspendJob(): Promise<AutoSuspendJobResult> {
  const result = await autoSuspendRun();
  await recordAudit({
    actorUserId: null,
    action: 'jobs.autosuspend.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      evaluated: result.evaluated,
      suspended: result.suspended,
      lifted: result.lifted,
      warned1: result.warned1,
      warned2: result.warned2,
      errorCount: result.errors.length,
    },
  });
  return result;
}
