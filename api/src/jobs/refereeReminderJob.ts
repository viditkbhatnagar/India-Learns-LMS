import { Application, Program, Referee, User } from '../models/index.js';
import { recordAudit } from '../services/auditService.js';
import { getIntegrations } from '../integrations/index.js';
import { generateOpaqueToken } from '../services/tokenService.js';
import { RefereeUploadToken } from '../models/admissions/referee.js';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

const REMINDER_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_TTL_DAYS = 30;

export interface RefereeReminderResult {
  evaluated: number;
  reminded: number;
  expired: number;
  errors: string[];
}

// M3b — Daily scan: any referee invited > 7 days ago and not yet uploaded
// gets one reminder email. Tokens older than 30 days get marked expired so
// the public route returns 410.

export async function runRefereeReminderJob(): Promise<RefereeReminderResult> {
  const now = Date.now();
  const cutoffReminder = new Date(now - REMINDER_AFTER_MS);
  const result: RefereeReminderResult = {
    evaluated: 0,
    reminded: 0,
    expired: 0,
    errors: [],
  };
  // Reminders.
  const candidates = await Referee.find({
    status: 'invited',
    invitedAt: { $lte: cutoffReminder },
    remindedAt: null,
  }).limit(500);
  result.evaluated = candidates.length;
  const { email: mailer } = getIntegrations();
  const env = loadEnv();
  // Process serially — referee reminders go through the email provider's
  // rate limit, and emitting 500 parallel sends in a burst would risk a
  // provider throttle. Plain for-of with awaits is intentional.
  /* eslint-disable no-await-in-loop */
  for (const referee of candidates) {
    try {
      await RefereeUploadToken.updateMany(
        { refereeId: referee._id, usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
      );
      const { plain, tokenHash } = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);
      await RefereeUploadToken.create({
        refereeId: referee._id,
        applicationId: referee.applicationId,
        tokenHash,
        expiresAt,
        usedAt: null,
      });
      const application = await Application.findById(referee.applicationId);
      const applicant = application
        ? await User.findById(application.applicantUserId).select('name')
        : null;
      const program = application?.programId
        ? await Program.findById(application.programId).select('name')
        : null;
      const link = `${env.WEB_ORIGIN.replace(/\/$/, '')}/refer/${encodeURIComponent(plain)}`;
      await mailer.send({
        to: referee.email,
        subject: `Reminder: upload your letter for ${applicant?.name ?? 'a prospective student'}`,
        html: `<p>Hi ${referee.name},</p>
          <p>This is a friendly reminder that ${applicant?.name ?? 'a prospective student'} is waiting on your letter${program ? ` for ${program.name}` : ''}.</p>
          <p><a href="${link}">${link}</a></p>
          <p>This link expires in ${TOKEN_TTL_DAYS} days and can only be used once.</p>`,
        text: `Hi ${referee.name},\n\nReminder — ${applicant?.name ?? 'a prospective student'} is waiting on your letter.\nUpload here (expires in ${TOKEN_TTL_DAYS} days, single use):\n${link}\n`,
        tag: 'referee-reminder',
        vars: { name: referee.name, refereeUrl: link },
      });
      referee.status = 'reminded';
      referee.remindedAt = new Date();
      await referee.save();
      result.reminded += 1;
    } catch (err) {
      logger.warn({ err, refereeId: String(referee._id) }, 'referee.reminder.failed');
      result.errors.push(`reminder ${String(referee._id)}: ${(err as Error).message}`);
    }
  }
  /* eslint-enable no-await-in-loop */

  // Expirations — referees still invited/reminded and last invited > TOKEN_TTL_DAYS ago.
  const cutoffExpire = new Date(now - TOKEN_TTL_DAYS * 86_400_000);
  const expiredUpdate = await Referee.updateMany(
    {
      status: { $in: ['invited', 'reminded'] },
      invitedAt: { $lte: cutoffExpire },
    },
    { $set: { status: 'expired' } },
  );
  result.expired = expiredUpdate.modifiedCount ?? 0;

  await recordAudit({
    actorUserId: null,
    action: 'jobs.notifications_retry.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      job: 'referee_reminder',
      evaluated: result.evaluated,
      reminded: result.reminded,
      expired: result.expired,
      errorCount: result.errors.length,
    },
  });
  return result;
}
