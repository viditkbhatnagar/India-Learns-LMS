import { Types } from 'mongoose';
import { getIntegrations } from '../integrations/index.js';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';
import {
  AttendanceRecord,
  Course,
  SessionModel,
  User,
} from '../models/index.js';

// M10 — Daily attendance auto-report (LMS_Requirements §2 + §5).
//
// At 18:30 IST every day we look at attendance recorded on the current
// UTC day (which spans IST's 05:30 → next-day 05:30 — practically the
// whole school day). For each student with at least one attendance row
// today we build a one-paragraph summary and email it to the student's
// own inbox + their parent/guardian email if `User.parentGuardian.email`
// is set.
//
// In dev (EMAIL_PROVIDER=stub) the email adapter logs the payload but
// doesn't ship anywhere — the job still walks the dataset so the audit
// trail and counters are honest.

export interface DailyAttendanceJobResult {
  date: string;
  studentsWithAttendance: number;
  emailsSent: number;
  emailErrors: number;
  parentEmailsAttempted: number;
}

interface RawAttendanceRow {
  studentId: Types.ObjectId;
  sessionId: Types.ObjectId;
  courseId: Types.ObjectId;
  status: string;
}

interface StudentBucket {
  studentId: string;
  studentName: string;
  studentEmail: string;
  parentEmail: string | null;
  rows: Array<{
    courseName: string;
    sessionId: string;
    status: string;
    sessionStartIst: string | null;
  }>;
}

function utcDayBounds(now: Date): { from: Date; to: Date; isoDate: string } {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const from = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
  const to = new Date(`${y}-${m}-${d}T23:59:59.999Z`);
  return { from, to, isoDate: `${y}-${m}-${d}` };
}

function statusLabel(s: string): string {
  if (s === 'present') return 'Present';
  if (s === 'absent') return 'Absent';
  if (s === 'late') return 'Late';
  if (s === 'excused') return 'Excused';
  return s;
}

function renderEmail(
  bucket: StudentBucket,
  toParent: boolean,
  isoDate: string,
): { subject: string; text: string; html: string } {
  const greeting = toParent
    ? `Hello,\n\nBelow is today's attendance summary for ${bucket.studentName}.`
    : `Hi ${bucket.studentName.split(' ')[0]},\n\nHere is your attendance summary for today.`;
  const lines = [greeting, ''];
  for (const r of bucket.rows) {
    lines.push(
      `  • ${r.courseName} — ${statusLabel(r.status)}${
        r.sessionStartIst ? ` (${r.sessionStartIst})` : ''
      }`,
    );
  }
  lines.push('');
  lines.push(
    toParent
      ? 'If you have any concerns, please reach out to the programme office.'
      : 'Open the portal for full details on each class.',
  );
  const env = loadEnv();
  lines.push(`India Learns · ${env.WEB_ORIGIN}`);
  const text = lines.join('\n');
  const html = `<p>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')}</p>`;
  const subject = `India Learns — attendance for ${bucket.studentName} on ${isoDate}`;
  return { subject, text, html };
}

export async function runDailyAttendanceReport(
  now = new Date(),
): Promise<DailyAttendanceJobResult> {
  const { from, to, isoDate } = utcDayBounds(now);

  // 1. Pull today's attendance rows. Lean for speed — we hydrate names
  //    in a separate pass below.
  const rows = (await AttendanceRecord.find({
    markedAt: { $gte: from, $lte: to },
  })
    .select({ studentId: 1, sessionId: 1, courseId: 1, status: 1 })
    .lean()) as unknown as RawAttendanceRow[];

  if (rows.length === 0) {
    return {
      date: isoDate,
      studentsWithAttendance: 0,
      emailsSent: 0,
      emailErrors: 0,
      parentEmailsAttempted: 0,
    };
  }

  const studentIds = [...new Set(rows.map((r) => String(r.studentId)))].map(
    (s) => new Types.ObjectId(s),
  );
  const courseIds = [...new Set(rows.map((r) => String(r.courseId)))].map(
    (c) => new Types.ObjectId(c),
  );
  const sessionIds = [...new Set(rows.map((r) => String(r.sessionId)))].map(
    (s) => new Types.ObjectId(s),
  );

  const [students, courses, sessions] = await Promise.all([
    User.find({ _id: { $in: studentIds }, status: { $ne: 'revoked' } })
      .select({ name: 1, email: 1, parentGuardian: 1 })
      .lean(),
    Course.find({ _id: { $in: courseIds } })
      .select({ name: 1 })
      .lean(),
    SessionModel.find({ _id: { $in: sessionIds } })
      .select({ scheduledStart: 1 })
      .lean(),
  ]);

  const courseMap = new Map(courses.map((c) => [String(c._id), c.name as string]));
  const sessionStartMap = new Map(
    sessions.map((s: { _id: Types.ObjectId; scheduledStart: Date | null }) => [
      String(s._id),
      s.scheduledStart
        ? s.scheduledStart.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : null,
    ]),
  );

  // 2. Bucket rows per student.
  const buckets = new Map<string, StudentBucket>();
  for (const s of students) {
    buckets.set(String(s._id), {
      studentId: String(s._id),
      studentName: s.name as string,
      studentEmail: s.email as string,
      parentEmail: (s.parentGuardian as { email?: string | null } | null)?.email ?? null,
      rows: [],
    });
  }
  for (const r of rows) {
    const bucket = buckets.get(String(r.studentId));
    if (!bucket) continue;
    bucket.rows.push({
      courseName: courseMap.get(String(r.courseId)) ?? '(deleted course)',
      sessionId: String(r.sessionId),
      status: r.status,
      sessionStartIst: sessionStartMap.get(String(r.sessionId)) ?? null,
    });
  }

  // 3. Send emails. Stub adapter in dev; brevo/resend/sendgrid in prod.
  const { email } = getIntegrations();
  let emailsSent = 0;
  let emailErrors = 0;
  let parentEmailsAttempted = 0;
  for (const bucket of buckets.values()) {
    if (bucket.rows.length === 0) continue;
    // Student inbox.
    try {
      const { subject, text, html } = renderEmail(bucket, false, isoDate);
      await email.send({
        to: bucket.studentEmail,
        subject,
        html,
        text,
        tag: 'attendance.daily.student',
      });
      emailsSent += 1;
    } catch (err) {
      emailErrors += 1;
      logger.warn(
        { err, studentId: bucket.studentId },
        'daily_attendance.student_email_failed',
      );
    }
    // Parent inbox if set.
    if (bucket.parentEmail) {
      parentEmailsAttempted += 1;
      try {
        const { subject, text, html } = renderEmail(bucket, true, isoDate);
        await email.send({
          to: bucket.parentEmail,
          subject,
          html,
          text,
          tag: 'attendance.daily.parent',
        });
        emailsSent += 1;
      } catch (err) {
        emailErrors += 1;
        logger.warn(
          { err, studentId: bucket.studentId },
          'daily_attendance.parent_email_failed',
        );
      }
    }
  }

  return {
    date: isoDate,
    studentsWithAttendance: buckets.size,
    emailsSent,
    emailErrors,
    parentEmailsAttempted,
  };
}
