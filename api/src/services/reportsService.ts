import { Types } from 'mongoose';
import type {
  AssignmentSubmissionsReportDto,
  AssignmentSubmissionsReportFilters,
  AssignmentSubmissionsReportCell,
  AssignmentSubmissionsReportAssignment,
  AssignmentSubmissionsReportStudent,
  AssignmentSubmissionReportStatus,
  AttendanceReportDto,
  AttendanceReportFilters,
  AttendanceReportRow,
  BatchSummaryReportDto,
  BatchSummaryReportFilters,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  Batch,
  Course,
  Enrollment,
  Invoice,
  Program,
  SessionModel,
  User,
} from '../models/index.js';

// M10 — Reports module backend (LMS_Faculty_Features_Requirements_ §4).
// Three batch-scoped reports. Each is a fan-out: enrollment → student set
// + course set, then a couple of joins on AttendanceRecord / Assignment /
// AssignmentSubmission / Invoice. Faculty authz lives at the route layer
// (this service trusts the batchId).

// --------- Helpers ----------------------------------------------------

function requireObjectId(id: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(404, 'NOT_FOUND', `${label} not found.`);
  }
  return new Types.ObjectId(id);
}

function dayBoundsUtc(fromIso: string, toIso: string): { from: Date; to: Date } {
  // Inclusive day range. `from` snaps to 00:00 UTC, `to` snaps to 23:59:59 UTC
  // — the IST display layer adjusts; for analytics we want a full UTC day.
  const from = new Date(`${fromIso.slice(0, 10)}T00:00:00.000Z`);
  const to = new Date(`${toIso.slice(0, 10)}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'from/to must be ISO dates (YYYY-MM-DD).');
  }
  if (from > to) {
    throw new HttpError(422, 'VALIDATION_FAILED', '`from` must be ≤ `to`.');
  }
  return { from, to };
}

async function loadBatchContext(batchIdStr: string): Promise<{
  batchId: Types.ObjectId;
  batchCode: string;
  programName: string;
  programId: Types.ObjectId;
}> {
  const batchId = requireObjectId(batchIdStr, 'Batch');
  const batch = await Batch.findById(batchId);
  if (!batch || batch.deletedAt) throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  const program = await Program.findById(batch.programId);
  if (!program) throw new HttpError(404, 'NOT_FOUND', 'Program for batch not found.');
  return {
    batchId,
    // Batches don't carry a code field today — surface the name. This is
    // what staff already see in the timetable / fees UIs.
    batchCode: batch.name,
    programName: program.name,
    programId: program._id,
  };
}

// --------- Attendance report -----------------------------------------

export async function buildAttendanceReport(
  filters: AttendanceReportFilters,
): Promise<AttendanceReportDto> {
  const { batchId, batchCode, programName } = await loadBatchContext(filters.batchId);
  const { from, to } = dayBoundsUtc(filters.from, filters.to);
  const courseFilter: Types.ObjectId | null = filters.courseId
    ? requireObjectId(filters.courseId, 'Course')
    : null;

  // 1. Roster — enrolled students for this batch (and optional course).
  const enrollmentFilter: Record<string, unknown> = { batchId, status: { $ne: 'revoked' } };
  if (courseFilter) enrollmentFilter.courseId = courseFilter;
  const enrollments = await Enrollment.find(enrollmentFilter).lean();
  const studentIdSet = new Set(enrollments.map((e) => String(e.studentId)));
  const courseIdSet = new Set(enrollments.map((e) => String(e.courseId)));
  const studentObjIds = [...studentIdSet].map((s) => new Types.ObjectId(s));
  const courseObjIds = [...courseIdSet].map((c) => new Types.ObjectId(c));

  // 2. Sessions in range — bounds the universe of attendance rows we count.
  //    M10u — optional "sessions held" window narrows to sessions whose
  //    actual held-date (completedAt fallback to scheduledStart) falls in
  //    [sessionsHeldFrom, sessionsHeldTo]. We post-filter in JS because
  //    Mongo can't easily $or across two date fields with a single index.
  const sessions = await SessionModel.find({
    courseId: { $in: courseObjIds },
    scheduledStart: { $gte: from, $lte: to },
  })
    .select({ _id: 1, scheduledStart: 1, completedAt: 1 })
    .lean();
  const heldFrom = filters.sessionsHeldFrom
    ? dayBoundsUtc(filters.sessionsHeldFrom, filters.sessionsHeldFrom).from
    : null;
  const heldTo = filters.sessionsHeldTo
    ? dayBoundsUtc(filters.sessionsHeldTo, filters.sessionsHeldTo).to
    : null;
  const filteredSessions =
    heldFrom || heldTo
      ? sessions.filter((s) => {
          const held =
            (s.completedAt as Date | null | undefined) ??
            (s.scheduledStart as Date | null | undefined);
          if (!held) return false;
          if (heldFrom && held < heldFrom) return false;
          if (heldTo && held > heldTo) return false;
          return true;
        })
      : sessions;
  const sessionObjIds = filteredSessions.map((s: { _id: Types.ObjectId }) => s._id);
  const sessionCount = filteredSessions.length;

  // 3. Attendance for that universe, restricted to roster students.
  const records = await AttendanceRecord.find({
    sessionId: { $in: sessionObjIds },
    studentId: { $in: studentObjIds },
  })
    .select({ studentId: 1, status: 1 })
    .lean();

  // 4. Aggregate per student.
  const counts = new Map<
    string,
    { present: number; absent: number; late: number; excused: number }
  >();
  for (const sid of studentIdSet) {
    counts.set(sid, { present: 0, absent: 0, late: 0, excused: 0 });
  }
  for (const r of records) {
    const slot = counts.get(String(r.studentId));
    if (!slot) continue;
    slot[r.status as keyof typeof slot] += 1;
  }

  // 5. Hydrate student display fields.
  const studentDocs = await User.find({ _id: { $in: studentObjIds } })
    .select({ name: 1, code: 1 })
    .lean();
  const studentMap = new Map(
    studentDocs.map((s) => [String(s._id), { name: s.name as string, code: s.code as string | null }]),
  );

  const rows: AttendanceReportRow[] = [...studentIdSet].map((sid) => {
    const c = counts.get(sid)!;
    const display = studentMap.get(sid) ?? { name: '(deleted)', code: null };
    const totalMarked = c.present + c.absent + c.late + c.excused;
    // Attendance rate: present + late count as "attended"; excused excluded
    // from both numerator and denominator (the student didn't owe presence).
    const denom = totalMarked - c.excused;
    const attended = c.present + c.late;
    const rate = denom > 0 ? Math.round((attended / denom) * 1000) / 10 : 0;
    return {
      studentId: sid,
      studentCode: display.code,
      studentName: display.name,
      presentCount: c.present,
      absentCount: c.absent,
      lateCount: c.late,
      excusedCount: c.excused,
      totalMarked,
      attendanceRate: rate,
    };
  });
  rows.sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    filters,
    batchCode,
    programName,
    generatedAt: new Date().toISOString(),
    sessionCount,
    rows,
  };
}

// --------- Batch summary report --------------------------------------

export async function buildBatchSummaryReport(
  filters: BatchSummaryReportFilters,
): Promise<BatchSummaryReportDto> {
  const { batchId, batchCode, programName } = await loadBatchContext(filters.batchId);

  const enrollments = await Enrollment.find({ batchId, status: { $ne: 'revoked' } }).lean();
  const studentIdSet = new Set(enrollments.map((e) => String(e.studentId)));
  const courseIdSet = new Set(enrollments.map((e) => String(e.courseId)));
  const studentObjIds = [...studentIdSet].map((s) => new Types.ObjectId(s));
  const courseObjIds = [...courseIdSet].map((c) => new Types.ObjectId(c));

  // Activity stats — counts of users who haven't been suspended/revoked.
  const studentDocs = await User.find({
    _id: { $in: studentObjIds },
  })
    .select({ status: 1 })
    .lean();
  const activeStudentCount = studentDocs.filter((s) => s.status === 'active').length;

  // Sessions + attendance (all-time for this batch).
  const sessions = await SessionModel.find({ courseId: { $in: courseObjIds } })
    .select({ _id: 1 })
    .lean();
  const sessionObjIds = sessions.map((s: { _id: Types.ObjectId }) => s._id);

  const attendanceAgg = await AttendanceRecord.aggregate([
    { $match: { sessionId: { $in: sessionObjIds }, studentId: { $in: studentObjIds } } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const attendanceCounts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const a of attendanceAgg) {
    const key = a._id as keyof typeof attendanceCounts;
    if (key in attendanceCounts) attendanceCounts[key] = a.n as number;
  }
  const attendedAll = attendanceCounts.present + attendanceCounts.late;
  const denomAll =
    attendanceCounts.present + attendanceCounts.absent + attendanceCounts.late;
  const averageAttendanceRate =
    denomAll > 0 ? Math.round((attendedAll / denomAll) * 1000) / 10 : 0;

  // Assignments + submissions.
  const assignments = await Assignment.find({ courseId: { $in: courseObjIds } })
    .select({ _id: 1 })
    .lean();
  const assignmentObjIds = assignments.map((a) => a._id);
  const submissionAgg = await AssignmentSubmission.aggregate([
    { $match: { assignmentId: { $in: assignmentObjIds }, studentId: { $in: studentObjIds } } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const submissionCounts: Record<string, number> = {};
  for (const s of submissionAgg) submissionCounts[s._id as string] = s.n as number;

  // Fees — sum invoice amountTotals and outstanding for batch students.
  const invoices = await Invoice.find({
    studentId: { $in: studentObjIds },
  })
    .select({ totalPaise: 1, paidPaise: 1, status: 1 })
    .lean();
  let totalBilled = 0;
  let totalCollected = 0;
  for (const inv of invoices) {
    // Cancelled / waived invoices don't count toward billed totals.
    if (inv.status === 'cancelled' || inv.status === 'waived') continue;
    totalBilled += (inv.totalPaise as number) ?? 0;
    totalCollected += (inv.paidPaise as number) ?? 0;
  }

  return {
    filters,
    batchCode,
    programName,
    generatedAt: new Date().toISOString(),
    enrolledStudentCount: studentIdSet.size,
    activeStudentCount,
    averageAttendanceRate,
    totalSessions: sessions.length,
    totalAssignments: assignments.length,
    publishedSubmissionCount: submissionCounts.published ?? 0,
    draftSubmissionCount: submissionCounts.graded_draft ?? 0,
    needsGradingCount: submissionCounts.needs_grading ?? 0,
    totalBilledPaise: totalBilled,
    totalCollectedPaise: totalCollected,
    totalOutstandingPaise: Math.max(0, totalBilled - totalCollected),
  };
}

// --------- Assignment submissions report -----------------------------

export async function buildAssignmentSubmissionsReport(
  filters: AssignmentSubmissionsReportFilters,
): Promise<AssignmentSubmissionsReportDto> {
  const { batchId, batchCode, programName } = await loadBatchContext(filters.batchId);
  const { from, to } = dayBoundsUtc(filters.from, filters.to);
  const courseFilter: Types.ObjectId | null = filters.courseId
    ? requireObjectId(filters.courseId, 'Course')
    : null;

  const enrollmentFilter: Record<string, unknown> = { batchId, status: { $ne: 'revoked' } };
  if (courseFilter) enrollmentFilter.courseId = courseFilter;
  const enrollments = await Enrollment.find(enrollmentFilter).lean();
  const studentIdSet = new Set(enrollments.map((e) => String(e.studentId)));
  const courseIdSet = new Set(enrollments.map((e) => String(e.courseId)));
  const studentObjIds = [...studentIdSet].map((s) => new Types.ObjectId(s));
  const courseObjIds = [...courseIdSet].map((c) => new Types.ObjectId(c));

  const [courseDocs, studentDocs] = await Promise.all([
    Course.find({ _id: { $in: courseObjIds } })
      .select({ name: 1 })
      .lean(),
    User.find({ _id: { $in: studentObjIds } })
      .select({ name: 1, code: 1 })
      .lean(),
  ]);
  const courseNameMap = new Map(courseDocs.map((c) => [String(c._id), c.name as string]));

  const assignmentDocs = await Assignment.find({
    courseId: { $in: courseObjIds },
    dueAt: { $gte: from, $lte: to },
  })
    .select({ _id: 1, courseId: 1, title: 1, dueAt: 1, maxScore: 1 })
    .lean();
  const assignmentObjIds = assignmentDocs.map((a) => a._id);
  const assignments: AssignmentSubmissionsReportAssignment[] = assignmentDocs.map((a) => ({
    id: String(a._id),
    courseId: String(a.courseId),
    courseName: courseNameMap.get(String(a.courseId)) ?? '(deleted course)',
    title: a.title as string,
    dueAt: (a.dueAt as Date).toISOString(),
    maxScore: (a.maxScore as number) ?? 0,
  }));
  // Stable order: by dueAt ascending, then title for ties.
  assignments.sort((a, b) =>
    a.dueAt === b.dueAt ? a.title.localeCompare(b.title) : a.dueAt.localeCompare(b.dueAt),
  );

  const students: AssignmentSubmissionsReportStudent[] = studentDocs
    .map((s) => ({
      id: String(s._id),
      code: (s.code as string | null) ?? null,
      name: s.name as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const submissions = await AssignmentSubmission.find({
    assignmentId: { $in: assignmentObjIds },
    studentId: { $in: studentObjIds },
  })
    .select({
      assignmentId: 1,
      studentId: 1,
      status: 1,
      score: 1,
      submittedAt: 1,
      lateFlag: 1,
    })
    .lean();

  const subMap = new Map<string, typeof submissions[number]>();
  for (const s of submissions) {
    subMap.set(`${String(s.assignmentId)}::${String(s.studentId)}`, s);
  }

  const cells: AssignmentSubmissionsReportCell[] = [];
  for (const a of assignments) {
    for (const st of students) {
      const sub = subMap.get(`${a.id}::${st.id}`);
      const status: AssignmentSubmissionReportStatus = sub
        ? (sub.status as AssignmentSubmissionReportStatus)
        : 'not_started';
      cells.push({
        assignmentId: a.id,
        studentId: st.id,
        status,
        score: sub?.score ?? null,
        submittedAt: sub?.submittedAt ? (sub.submittedAt as Date).toISOString() : null,
        lateFlag: Boolean(sub?.lateFlag),
      });
    }
  }

  return {
    filters,
    batchCode,
    programName,
    generatedAt: new Date().toISOString(),
    assignments,
    students,
    cells,
  };
}
