import { recordAudit } from '../services/auditService.js';
import {
  runDailyAttendanceReport,
  type DailyAttendanceJobResult,
} from '../services/dailyAttendanceReportService.js';

// M10 — Daily attendance auto-report cron handler.
//
// Wired to /v1/jobs/daily-attendance-report (POST, HMAC-signed) and
// scheduled at 13:00 UTC daily (= 18:30 IST). Idempotent in the soft
// sense: re-running on the same day re-sends the emails. The stub email
// adapter in dev makes this safe; in prod the cron schedule is once a
// day so the only way to double-send is a manual retry, which is what
// staff would want anyway after a backfill.

export async function runDailyAttendanceReportJob(): Promise<DailyAttendanceJobResult> {
  const result = await runDailyAttendanceReport();
  await recordAudit({
    actorUserId: null,
    action: 'jobs.daily_attendance.invoked',
    targetType: 'Job',
    targetId: null,
    details: {
      date: result.date,
      studentsWithAttendance: result.studentsWithAttendance,
      emailsSent: result.emailsSent,
      emailErrors: result.emailErrors,
      parentEmailsAttempted: result.parentEmailsAttempted,
    },
  });
  return result;
}
