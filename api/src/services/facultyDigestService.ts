import { Types } from 'mongoose';
import type { FacultyDigestJobResult } from 'india-learns-shared-types';
import {
  Course,
  Exam,
  ExamAttempt,
  FeedbackEntry,
  User,
} from '../models/index.js';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';
import { getIntegrations } from '../integrations/index.js';
import { nowUtc } from './clockService.js';

const SEVEN_DAYS_MS = 7 * 86_400_000;

export interface FacultyDigestItem {
  studentId: string;
  courseId: string;
  kind: 'ungraded_essay' | 'pending_feedback';
  attemptId?: string;
  submittedAt?: string;
  daysOld: number;
}

export interface FacultyDigestBucket {
  facultyId: string;
  facultyEmail: string;
  facultyName: string;
  items: FacultyDigestItem[];
}

export async function buildFacultyDigestBuckets(
  now = nowUtc(),
): Promise<FacultyDigestBucket[]> {
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  // 1. Ungraded essay attempts submitted > 7 days ago.
  const ungradedAttempts = await ExamAttempt.find({
    submittedAt: { $lte: sevenDaysAgo, $ne: null },
    totalScorePercent: null,
  })
    .select('_id examId studentId submittedAt')
    .lean();

  const examIds = Array.from(
    new Set(ungradedAttempts.map((a) => a.examId.toString())),
  );
  const exams = await Exam.find({ _id: { $in: examIds } })
    .select('_id courseId')
    .lean();
  const courseIdByExam = new Map<string, string>();
  exams.forEach((e) => courseIdByExam.set(e._id.toString(), e.courseId.toString()));

  // 2. Courses → faculty mapping.
  const allCourseIds = Array.from(new Set(exams.map((e) => e.courseId.toString())));
  const courses = await Course.find({ _id: { $in: allCourseIds } })
    .select('_id facultyIds')
    .lean();
  const facultyIdsByCourse = new Map<string, string[]>();
  courses.forEach((c) => {
    facultyIdsByCourse.set(
      c._id.toString(),
      c.facultyIds.map((id: Types.ObjectId) => id.toString()),
    );
  });

  // 3. Accumulate per faculty.
  const byFaculty = new Map<string, FacultyDigestItem[]>();
  ungradedAttempts.forEach((a) => {
    const courseId = courseIdByExam.get(a.examId.toString());
    if (!courseId) return;
    const faculty = facultyIdsByCourse.get(courseId) ?? [];
    if (faculty.length === 0) return;
    const daysOld = Math.floor((now.getTime() - a.submittedAt!.getTime()) / 86_400_000);
    faculty.forEach((fid) => {
      const list = byFaculty.get(fid) ?? [];
      list.push({
        studentId: a.studentId.toString(),
        courseId,
        kind: 'ungraded_essay',
        attemptId: a._id.toString(),
        submittedAt: a.submittedAt!.toISOString(),
        daysOld,
      });
      byFaculty.set(fid, list);
    });
  });

  // 4. Pending (draft/un-published) feedback owned by a faculty for >7 days.
  const staleDrafts = await FeedbackEntry.find({
    status: 'draft',
    createdAt: { $lte: sevenDaysAgo },
  })
    .select('_id facultyId studentId courseId createdAt')
    .lean();
  staleDrafts.forEach((f) => {
    const list = byFaculty.get(f.facultyId.toString()) ?? [];
    const daysOld = Math.floor(
      (now.getTime() - new Date(f.createdAt).getTime()) / 86_400_000,
    );
    list.push({
      studentId: f.studentId.toString(),
      courseId: f.courseId.toString(),
      kind: 'pending_feedback',
      daysOld,
    });
    byFaculty.set(f.facultyId.toString(), list);
  });

  // 5. Resolve faculty name + email.
  const facultyIds = Array.from(byFaculty.keys()).map((id) => new Types.ObjectId(id));
  const faculty = await User.find({ _id: { $in: facultyIds } })
    .select('_id name email')
    .lean();
  const facultyById = new Map<string, { name: string; email: string }>();
  faculty.forEach((f) => {
    facultyById.set(f._id.toString(), { name: f.name, email: f.email });
  });

  const buckets: FacultyDigestBucket[] = [];
  byFaculty.forEach((items, fid) => {
    const meta = facultyById.get(fid);
    if (!meta) return;
    buckets.push({
      facultyId: fid,
      facultyEmail: meta.email,
      facultyName: meta.name,
      items,
    });
  });

  return buckets;
}

function renderEmailBody(bucket: FacultyDigestBucket): { text: string; html: string } {
  const byCourse = new Map<string, FacultyDigestItem[]>();
  bucket.items.forEach((i) => {
    const list = byCourse.get(i.courseId) ?? [];
    list.push(i);
    byCourse.set(i.courseId, list);
  });
  const lines: string[] = [
    `Hello ${bucket.facultyName},`,
    '',
    `You have ${bucket.items.length} item(s) awaiting feedback:`,
    '',
  ];
  byCourse.forEach((items, courseId) => {
    lines.push(`Course ${courseId}:`);
    items.forEach((i) => {
      if (i.kind === 'ungraded_essay') {
        lines.push(
          `  • Essay awaiting grade (attempt ${i.attemptId}) — ${i.daysOld}d old`,
        );
      } else {
        lines.push(`  • Draft feedback for student ${i.studentId} — ${i.daysOld}d old`);
      }
    });
    lines.push('');
  });
  const env = loadEnv();
  lines.push(`Give feedback now: ${env.WEB_ORIGIN}/faculty/feedback`);
  const text = lines.join('\n');
  const html = `<p>${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')}</p>`;
  return { text, html };
}

export async function runFacultyDigest(
  now = nowUtc(),
): Promise<FacultyDigestJobResult> {
  const buckets = await buildFacultyDigestBuckets(now);
  let emailsSent = 0;
  let emailErrors = 0;
  const { email } = getIntegrations();
  for (const bucket of buckets) {
    const { text, html } = renderEmailBody(bucket);
    try {
      await email.send({
        to: bucket.facultyEmail,
        subject: `Faculty weekly digest — ${bucket.items.length} pending item(s)`,
        html,
        text,
        tag: 'faculty.weekly_digest',
      });
      emailsSent += 1;
    } catch (err) {
      emailErrors += 1;
      logger.warn(
        { err, facultyId: bucket.facultyId },
        'faculty_digest.email_failed',
      );
    }
  }
  return {
    processed: buckets.length,
    facultyCount: buckets.length,
    totalPendingItems: buckets.reduce((sum, b) => sum + b.items.length, 0),
    emailsSent,
    emailErrors,
  };
}
