import {
  ApplicationDocument,
  ApplicationDraft,
  Application,
  RefereeUploadToken,
  Referee,
} from '../models/index.js';
import { recordAudit } from '../services/auditService.js';
import { getIntegrations } from '../integrations/index.js';
import { logger } from '../config/logger.js';

// M9 — Draft cleanup + orphan storage GC.
//
// MongoDB's TTL index on ApplicationDraft.lastModifiedAt auto-expires draft
// docs older than the retention period (90 days). But that's only the
// document — uploaded files in Cloudinary, referee tokens, and the parent
// Application row don't auto-cascade. This job sweeps the orphans.

const ORPHAN_GRACE_DAYS = 90;

export interface DraftCleanupResult {
  draftsDropped: number;
  applicationsDropped: number;
  documentsDropped: number;
  refereeTokensDropped: number;
  refereesDropped: number;
  storageDeletes: number;
  errors: string[];
}

export async function runAdmissionsDraftCleanupJob(): Promise<DraftCleanupResult> {
  const result: DraftCleanupResult = {
    draftsDropped: 0,
    applicationsDropped: 0,
    documentsDropped: 0,
    refereeTokensDropped: 0,
    refereesDropped: 0,
    storageDeletes: 0,
    errors: [],
  };
  const cutoff = new Date(Date.now() - ORPHAN_GRACE_DAYS * 86_400_000);

  // 1. Find draft Applications that haven't been touched in the grace window.
  const staleApps = await Application.find({
    state: 'draft',
    updatedAt: { $lte: cutoff },
  })
    .limit(200)
    .select('_id applicantUserId');
  // Process serially — the cleanup hits MongoDB + Cloudinary for each app
  // and we'd rather pace it than fan out 200 concurrent storage deletes.
  /* eslint-disable no-await-in-loop */
  for (const app of staleApps) {
    try {
      const appId = app._id;
      // a. Delete Cloudinary objects for any documents attached.
      const docs = await ApplicationDocument.find({ applicationId: appId });
      const { storage } = getIntegrations();
      for (const doc of docs) {
        try {
          await storage.delete(doc.key);
          result.storageDeletes += 1;
        } catch (err) {
          logger.warn({ err, key: doc.key }, 'admissions.cleanup.storage_delete_failed');
        }
      }
      result.documentsDropped += (await ApplicationDocument.deleteMany({ applicationId: appId })).deletedCount ?? 0;

      // b. Drop referee tokens + referees (their letters live in
      // ApplicationDocument and are already deleted above).
      const referees = await Referee.find({ applicationId: appId });
      const refereeIds = referees.map((r) => r._id);
      if (refereeIds.length > 0) {
        result.refereeTokensDropped += (await RefereeUploadToken.deleteMany({
          refereeId: { $in: refereeIds },
        })).deletedCount ?? 0;
        result.refereesDropped += (await Referee.deleteMany({ _id: { $in: refereeIds } })).deletedCount ?? 0;
      }

      // c. Drop the draft + the parent Application.
      result.draftsDropped += (await ApplicationDraft.deleteMany({ applicationId: appId })).deletedCount ?? 0;
      result.applicationsDropped += (await Application.deleteOne({ _id: appId })).deletedCount ?? 0;
    } catch (err) {
      logger.warn({ err, appId: String(app._id) }, 'admissions.cleanup.app_failed');
      result.errors.push(`${String(app._id)}: ${(err as Error).message}`);
    }
  }
  /* eslint-enable no-await-in-loop */

  await recordAudit({
    actorUserId: null,
    // Reuse notifications_retry as the job-invocation slot — see
    // refereeReminderJob for the same pattern. Discriminator in details.job.
    action: 'jobs.notifications_retry.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      job: 'admissions_draft_cleanup',
      ...result,
    },
  });
  return result;
}
