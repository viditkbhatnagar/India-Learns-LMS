import { Types } from 'mongoose';
import type {
  AnalyticsSummaryDto,
  CollectionsReportDto,
  SlaBreachReportDto,
  TicketCategory,
} from 'india-learns-shared-types';
import {
  ApiCostLedger,
  Enrollment,
  ExamAttempt,
  FeedbackEntry,
  Payment,
  QuizAttempt,
  Ticket,
  User,
} from '../models/index.js';
import { nowUtc } from './clockService.js';

// M8 — Analytics service (TRD §5.12, PRD §15). All aggregates read directly
// from collections built up over M2–M7; no separate ETL. Summary uses an
// in-memory TTL cache (5 min) per TRD §6 line 753. `now` is parameterised so
// tests can time-travel via clockService.
//
// Stakeholder follow-up (post-first-demo): the summary now supports optional
// filters — programId (narrows to students in that program) and a [from, to]
// date range (applies to all time-windowed metrics). Defaults reproduce the
// original "this month / YTD / 14d rolling" semantics bit-for-bit so existing
// callers and tests see zero drift.

const SUMMARY_TTL_MS = 5 * 60 * 1000;
const summaryCache = new Map<string, { expiresAt: number; value: AnalyticsSummaryDto }>();

export function clearAnalyticsCache(): void {
  summaryCache.clear();
}

function cacheKey(opts: { programId?: string; from?: Date; to?: Date }): string {
  return `${opts.programId ?? ''}|${opts.from?.toISOString() ?? ''}|${opts.to?.toISOString() ?? ''}`;
}

function startOfUtcDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function endOfUtcDay(d: Date): Date {
  const out = startOfUtcDay(d);
  out.setUTCDate(out.getUTCDate() + 1);
  return out;
}

function daysAgo(now: Date, n: number): Date {
  const out = startOfUtcDay(now);
  out.setUTCDate(out.getUTCDate() - n);
  return out;
}

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfYear(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
}

// ISO 8601 week helpers — week starts Monday. Returns `{ start, end }`
// inclusive-exclusive (Mon 00:00 → next Mon 00:00 UTC).
export function parseIsoWeek(week: string): { start: Date; end: Date } {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(week);
  if (!match) {
    throw new Error(`Invalid ISO week: ${week}`);
  }
  const year = Number(match[1]);
  const weekNum = Number(match[2]);
  // Jan 4 is always in week 1 per ISO 8601.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const week1Monday = new Date(jan4.getTime() - jan4DayOfWeek * 86_400_000);
  const start = new Date(week1Monday.getTime() + (weekNum - 1) * 7 * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start, end };
}

interface Scope {
  /** Student IDs to narrow by (null = all students). Resolved up-front once
      per summary call from the programId filter. */
  studentIds: Types.ObjectId[] | null;
  /** `{ from, to }` if the caller supplied a date range — else null, and
      each metric falls back to its default window (this-month / YTD / 14d /
      this-week) so existing contracts are preserved. */
  range: { from: Date; to: Date } | null;
}

function scopedStudentFilter(scope: Scope): Record<string, unknown> {
  return scope.studentIds ? { studentId: { $in: scope.studentIds } } : {};
}

async function studentsByStatus(now: Date, scope: Scope) {
  const base: Record<string, unknown> = { role: 'student', deletedAt: null };
  if (scope.studentIds) base._id = { $in: scope.studentIds };

  const [active, suspended] = await Promise.all([
    User.countDocuments({ ...base, status: 'active' }),
    User.countDocuments({ ...base, status: 'suspended' }),
  ]);
  // "In trial today" = active students created within the selected window
  // (or within the last 14 days when no range is passed).
  const trialFrom = scope.range?.from ?? daysAgo(now, 14);
  const trialTo = scope.range?.to ?? endOfUtcDay(now);
  const inTrialToday = await User.countDocuments({
    ...base,
    status: 'active',
    createdAt: { $gte: trialFrom, $lt: trialTo },
  });
  return { active, suspended, inTrialToday };
}

async function admissionsCounts(now: Date, scope: Scope) {
  const programFilter: Record<string, unknown> = {};
  if (scope.studentIds) programFilter.studentId = { $in: scope.studentIds };

  if (scope.range) {
    // Windowed: "thisMonth" becomes "in range"; ytd is redundant so mirrors.
    const inRange = await Enrollment.countDocuments({
      ...programFilter,
      createdAt: { $gte: scope.range.from, $lt: scope.range.to },
    });
    return { thisMonth: inRange, ytd: inRange };
  }
  const [thisMonth, ytd] = await Promise.all([
    Enrollment.countDocuments({
      ...programFilter,
      createdAt: { $gte: startOfMonth(now) },
    }),
    Enrollment.countDocuments({
      ...programFilter,
      createdAt: { $gte: startOfYear(now) },
    }),
  ]);
  return { thisMonth, ytd };
}

async function feesTotals(now: Date, scope: Scope) {
  const studentFilter = scopedStudentFilter(scope);
  const feeInstallmentModel = (await import('../models/index.js')).FeeInstallment;

  if (scope.range) {
    const [rangeAgg, outstandingAgg] = await Promise.all([
      Payment.aggregate<{ total: number }>([
        {
          $match: {
            ...studentFilter,
            reversed: false,
            receivedAt: { $gte: scope.range.from, $lt: scope.range.to },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
      feeInstallmentModel.aggregate<{ total: number }>([
        {
          $match: {
            ...studentFilter,
            status: { $in: ['pending', 'partial', 'overdue'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountPaise' } } },
      ]),
    ]);
    const windowed = rangeAgg[0]?.total ?? 0;
    return {
      // Both fields show the windowed value; UI labels fall to "in selected
      // range" when a range is active, so there's no user confusion.
      collectedThisMonthPaise: windowed,
      collectedYtdPaise: windowed,
      outstandingPaise: outstandingAgg[0]?.total ?? 0,
    };
  }
  const [monthAgg, ytdAgg, outstandingAgg] = await Promise.all([
    Payment.aggregate<{ total: number }>([
      {
        $match: {
          ...studentFilter,
          reversed: false,
          receivedAt: { $gte: startOfMonth(now) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate<{ total: number }>([
      {
        $match: {
          ...studentFilter,
          reversed: false,
          receivedAt: { $gte: startOfYear(now) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    feeInstallmentModel.aggregate<{ total: number }>([
      {
        $match: {
          ...studentFilter,
          status: { $in: ['pending', 'partial', 'overdue'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
  ]);
  return {
    collectedThisMonthPaise: monthAgg[0]?.total ?? 0,
    collectedYtdPaise: ytdAgg[0]?.total ?? 0,
    outstandingPaise: outstandingAgg[0]?.total ?? 0,
  };
}

async function assessmentsPassRate(now: Date, scope: Scope) {
  const from = scope.range?.from ?? daysAgo(now, 30);
  const to = scope.range?.to ?? endOfUtcDay(now);
  const studentFilter = scopedStudentFilter(scope);
  const [quizPassed, quizTotal, examPassed, examTotal] = await Promise.all([
    QuizAttempt.countDocuments({
      ...studentFilter,
      submittedAt: { $gte: from, $lt: to },
      passed: true,
    }),
    QuizAttempt.countDocuments({
      ...studentFilter,
      submittedAt: { $gte: from, $lt: to, $ne: null },
    }),
    ExamAttempt.countDocuments({
      ...studentFilter,
      submittedAt: { $gte: from, $lt: to },
      passed: true,
    }),
    ExamAttempt.countDocuments({
      ...studentFilter,
      submittedAt: { $gte: from, $lt: to, $ne: null },
    }),
  ]);
  const samples = quizTotal + examTotal;
  const quizPassRatePercent = quizTotal === 0 ? 0 : Math.round((quizPassed / quizTotal) * 100);
  const examPassRatePercent = examTotal === 0 ? 0 : Math.round((examPassed / examTotal) * 100);
  return { quizPassRatePercent, examPassRatePercent, samples };
}

async function slaBreachesThisWeek(now: Date, scope: Scope) {
  let from: Date;
  let to: Date;
  if (scope.range) {
    from = scope.range.from;
    to = scope.range.to;
  } else {
    const monday = startOfUtcDay(now);
    const dayOfWeek = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
    from = monday;
    to = new Date(monday.getTime() + 7 * 86_400_000);
  }

  const studentFilter = scopedStudentFilter(scope);
  const breaches = await Ticket.find({
    ...studentFilter,
    $or: [
      { slaAckBreachedAt: { $gte: from, $lt: to } },
      { slaResolveBreachedAt: { $gte: from, $lt: to } },
    ],
  }).select('category slaAckBreachedAt slaResolveBreachedAt');

  const byCategory = {
    academic: 0,
    administration: 0,
    finance: 0,
    technical: 0,
    complaints: 0,
  } satisfies Record<TicketCategory, number>;

  let thisWeek = 0;
  for (const t of breaches) {
    const bumped =
      (t.slaAckBreachedAt && t.slaAckBreachedAt >= from && t.slaAckBreachedAt < to)
      || (t.slaResolveBreachedAt
        && t.slaResolveBreachedAt >= from
        && t.slaResolveBreachedAt < to);
    if (bumped) {
      thisWeek += 1;
      byCategory[t.category as TicketCategory] += 1;
    }
  }
  return { thisWeek, byCategory };
}

async function feedbackCoverage(now: Date, scope: Scope) {
  const from = scope.range?.from ?? daysAgo(now, 7);
  const to = scope.range?.to ?? endOfUtcDay(now);
  const studentFilter = scopedStudentFilter(scope);
  const [publishedLast7d, submittedLast7d] = await Promise.all([
    FeedbackEntry.countDocuments({
      ...studentFilter,
      status: 'published',
      publishedAt: { $gte: from, $lt: to },
    }),
    ExamAttempt.countDocuments({
      ...studentFilter,
      submittedAt: { $gte: from, $lt: to },
    }),
  ]);
  const coveragePercent =
    submittedLast7d === 0
      ? 0
      : Math.round((publishedLast7d / submittedLast7d) * 100);
  return { coveragePercent, publishedLast7d };
}

async function apiCostThisMonth(now: Date, scope: Scope) {
  // API cost is tenant-wide; programId filter doesn't apply.
  const from = scope.range?.from ?? startOfMonth(now);
  const to = scope.range?.to ?? endOfUtcDay(now);
  const rows = await ApiCostLedger.aggregate<{
    _id: string;
    units: number;
    totalPaise: number;
  }>([
    { $match: { atUtc: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: '$provider',
        units: { $sum: '$units' },
        totalPaise: {
          $sum: { $multiply: ['$units', '$unitPaise'] },
        },
      },
    },
  ]);
  const byProvider = rows.map((r) => ({
    provider: r._id as 'email' | 'whatsapp' | 'storage' | 'certifier',
    units: r.units,
    totalPaise: r.totalPaise,
  }));
  const thisMonthPaise = byProvider.reduce((sum, r) => sum + r.totalPaise, 0);
  return { thisMonthPaise, byProvider };
}

/**
 * Resolve a 14-day daily-bucket window. If the caller supplied a range, we
 * show the last 14 calendar days of that range (capped at `to`). Otherwise,
 * we reproduce the original 14-days-up-to-now window.
 */
function sparklineWindow(now: Date, scope: Scope): { earliest: Date; latest: Date } {
  if (scope.range) {
    const latest = scope.range.to;
    const earliest = new Date(
      Math.max(scope.range.from.getTime(), latest.getTime() - 14 * 86_400_000),
    );
    return { earliest: startOfUtcDay(earliest), latest: startOfUtcDay(latest) };
  }
  return { earliest: daysAgo(now, 13), latest: endOfUtcDay(now) };
}

function bucketDays(earliest: Date, latest: Date): string[] {
  const days: string[] = [];
  let cursor = new Date(earliest);
  while (cursor < latest && days.length < 14) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return days;
}

async function sparklineFor(
  now: Date,
  scope: Scope,
  model: typeof User,
  dateField: string,
  baseMatch: Record<string, unknown>,
): Promise<{ days: string[]; values: number[] }> {
  const { earliest, latest } = sparklineWindow(now, scope);
  const match: Record<string, unknown> = {
    ...baseMatch,
    [dateField]: { $gte: earliest, $lt: latest },
  };
  if (scope.studentIds && !('studentId' in match)) {
    match.studentId = { $in: scope.studentIds };
  }
  const rows = await (model as unknown as {
    aggregate: (pipe: unknown[]) => Promise<Array<{ _id: string; c: number }>>;
  }).aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` },
        },
        c: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r._id, r.c));
  const days = bucketDays(earliest, latest);
  const values = days.map((d) => counts.get(d) ?? 0);
  return { days, values };
}

async function feesSparkline(now: Date, scope: Scope): Promise<{ days: string[]; values: number[] }> {
  const { earliest, latest } = sparklineWindow(now, scope);
  const match: Record<string, unknown> = {
    reversed: false,
    receivedAt: { $gte: earliest, $lt: latest },
  };
  if (scope.studentIds) match.studentId = { $in: scope.studentIds };
  const rows = await Payment.aggregate<{ _id: string; total: number }>([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$receivedAt' },
        },
        total: { $sum: '$amountPaise' },
      },
    },
  ]);
  const sums = new Map<string, number>();
  rows.forEach((r) => sums.set(r._id, r.total));
  const days = bucketDays(earliest, latest);
  const values = days.map((d) => sums.get(d) ?? 0);
  return { days, values };
}

async function slaBreachSparkline(now: Date, scope: Scope) {
  const { earliest, latest } = sparklineWindow(now, scope);
  const match: Record<string, unknown> = {
    $or: [
      { slaAckBreachedAt: { $gte: earliest, $lt: latest } },
      { slaResolveBreachedAt: { $gte: earliest, $lt: latest } },
    ],
  };
  if (scope.studentIds) match.studentId = { $in: scope.studentIds };
  const rows = await Ticket.aggregate<{ _id: string; c: number }>([
    { $match: match },
    {
      $project: {
        day: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $ifNull: ['$slaResolveBreachedAt', '$slaAckBreachedAt'],
            },
          },
        },
      },
    },
    { $group: { _id: '$day', c: { $sum: 1 } } },
  ]);
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r._id, r.c));
  const days = bucketDays(earliest, latest);
  const values = days.map((d) => counts.get(d) ?? 0);
  return { days, values };
}

export interface GetSummaryOptions {
  bypassCache?: boolean;
  /** Narrow student-anchored metrics (students.*, admissions.*, fees.*,
      assessments.*, feedback.*, sparklines.*) to this program. Does not
      affect apiCost (tenant-wide) or non-student tickets. */
  programId?: string;
  /** Window for all time-ranged metrics. Omit both for the legacy
      this-month / YTD / 14d / this-week defaults. */
  from?: Date;
  to?: Date;
}

export async function getAnalyticsSummary(
  options: GetSummaryOptions = {},
): Promise<AnalyticsSummaryDto> {
  const now = nowUtc();
  const key = cacheKey(options);
  const hit = summaryCache.get(key);
  if (!options.bypassCache && hit && hit.expiresAt > now.getTime()) {
    return hit.value;
  }

  // Resolve student set for the program filter. We do it once so every
  // metric re-uses the same cohort (and we only pay one round trip to the
  // User collection).
  let studentIds: Types.ObjectId[] | null = null;
  if (options.programId && Types.ObjectId.isValid(options.programId)) {
    const students = await User.find({
      role: 'student',
      programId: new Types.ObjectId(options.programId),
      deletedAt: null,
    }).select('_id');
    studentIds = students.map((s) => s._id);
    // If the program has zero students, every subsequent $in:[] returns
    // empty — that's the correct answer (don't special-case).
  }

  const scope: Scope = {
    studentIds,
    range:
      options.from && options.to
        ? { from: options.from, to: options.to }
        : null,
  };

  const [
    students,
    admissions,
    fees,
    assessments,
    slaBreaches,
    feedback,
    apiCost,
    studentsSpark,
    feesSpark,
    slaBreachSpark,
  ] = await Promise.all([
    studentsByStatus(now, scope),
    admissionsCounts(now, scope),
    feesTotals(now, scope),
    assessmentsPassRate(now, scope),
    slaBreachesThisWeek(now, scope),
    feedbackCoverage(now, scope),
    apiCostThisMonth(now, scope),
    sparklineFor(now, scope, Enrollment as unknown as typeof User, 'createdAt', {}),
    feesSparkline(now, scope),
    slaBreachSparkline(now, scope),
  ]);

  const value: AnalyticsSummaryDto = {
    generatedAt: now.toISOString(),
    students,
    admissions,
    fees,
    assessments,
    slaBreaches,
    feedback,
    apiCost,
    sparklines: {
      students: studentsSpark,
      feesCollected: feesSpark,
      slaBreaches: slaBreachSpark,
    },
  };
  summaryCache.set(key, { expiresAt: now.getTime() + SUMMARY_TTL_MS, value });
  return value;
}

export interface CollectionsRange {
  from: Date;
  to: Date;
}

export async function getCollectionsReport(
  range: CollectionsRange,
): Promise<CollectionsReportDto> {
  const rows = await Payment.aggregate<{
    _id: { day: string; mode: string };
    amountPaise: number;
    count: number;
  }>([
    {
      $match: {
        reversed: false,
        receivedAt: { $gte: range.from, $lt: range.to },
      },
    },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt' } },
          mode: '$method',
        },
        amountPaise: { $sum: '$amountPaise' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);
  const total = rows.reduce((s, r) => s + r.amountPaise, 0);
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    totalPaise: total,
    rows: rows.map((r) => ({
      day: r._id.day,
      mode: r._id.mode,
      component: 'tuition', // component-level breakdown not captured on Payment; aggregate by mode only
      amountPaise: r.amountPaise,
      count: r.count,
    })),
  };
}

export async function getSlaBreachReport(
  week: string,
): Promise<SlaBreachReportDto> {
  const { start, end } = parseIsoWeek(week);
  const rows = await Ticket.aggregate<{
    _id: TicketCategory;
    ackBreaches: number;
    resolveBreaches: number;
  }>([
    {
      $match: {
        $or: [
          { slaAckBreachedAt: { $gte: start, $lt: end } },
          { slaResolveBreachedAt: { $gte: start, $lt: end } },
        ],
      },
    },
    {
      $group: {
        _id: '$category',
        ackBreaches: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$slaAckBreachedAt', start] },
                  { $lt: ['$slaAckBreachedAt', end] },
                ],
              },
              1,
              0,
            ],
          },
        },
        resolveBreaches: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$slaResolveBreachedAt', start] },
                  { $lt: ['$slaResolveBreachedAt', end] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const byCategory = rows.map((r) => ({
    category: r._id,
    ackBreaches: r.ackBreaches,
    resolveBreaches: r.resolveBreaches,
    total: r.ackBreaches + r.resolveBreaches,
  }));
  const total = byCategory.reduce((s, r) => s + r.total, 0);
  return {
    week,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    total,
    byCategory,
  };
}
