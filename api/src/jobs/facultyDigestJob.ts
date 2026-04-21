import type { FacultyDigestJobResult } from 'india-learns-shared-types';
import { recordAudit } from '../services/auditService.js';
import { runFacultyDigest } from '../services/facultyDigestService.js';

export async function runFacultyDigestJob(): Promise<FacultyDigestJobResult> {
  const result = await runFacultyDigest();
  await recordAudit({
    actorUserId: null,
    action: 'jobs.faculty_digest.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      processed: result.processed,
      facultyCount: result.facultyCount,
      totalPendingItems: result.totalPendingItems,
      emailsSent: result.emailsSent,
      emailErrors: result.emailErrors,
    },
  });
  return result;
}
