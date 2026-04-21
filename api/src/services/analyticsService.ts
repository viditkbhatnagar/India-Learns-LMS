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

const SUMMARY_TTL_MS = 5 * 60 * 1000;
let summaryCache: { expiresAt: number; value: AnalyticsSummaryDto } | null = null;

export function clearAnalyticsCache(): void {
  summaryCache = null;
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

async function studentsByStatus(now: Date) {
  const [active, suspended] = await Promise.all([
    User.countDocuments({ role: 'student', status: 'active', deletedAt: null }),
    User.countDocuments({
      role: 'student',
      status: 'suspended',
      deletedAt: null,
    }),
  ]);
  // "In trial today" = students enrolled within the last 14d and paid nothing
  // — approximated as "created in last 14d".
  const inTrialToday = await User.countDocuments({
    role: 'student',
    status: 'active',
    deletedAt: null,
    createdAt: { $gte: daysAgo(now, 14) },
  });
  return { active, suspended, inTrialToday };
}

async function admissionsCounts(now: Date) {
  const [thisMonth, ytd] = await Promise.all([
    Enrollment.countDocuments({ createdAt: { $gte: startOfMonth(now) } }),
    Enrollment.countDocuments({ createdAt: { $gte: startOfYear(now) } }),
  ]);
  return { thisMonth, ytd };
}

async function feesTotals(now: Date) {
  const [monthAgg, ytdAgg, outstandingAgg] = await Promise.all([
    Payment.aggregate<{ total: number }>([
      { $match: { reversed: false, receivedAt: { $gte: startOfMonth(now) } } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $match: { reversed: false, receivedAt: { $gte: startOfYear(now) } } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
    // Outstanding = sum of pending/partial/overdue installments. We sum
    // `amountPaise` and let the ledger reconcile.
    (await import('../models/index.js')).FeeInstallment.aggregate<{ total: number }>([
      { $match: { status: { $in: ['pending', 'partial', 'overdue'] } } },
      { $group: { _id: null, total: { $sum: '$amountPaise' } } },
    ]),
  ]);
  return {
    collectedThisMonthPaise: monthAgg[0]?.total ?? 0,
    collectedYtdPaise: ytdAgg[0]?.total ?? 0,
    outstandingPaise: outstandingAgg[0]?.total ?? 0,
  };
}

async function assessmentsPassRate(now: Date) {
  const from = daysAgo(now, 30);
  const [quizPassed, quizTotal, examPassed, examTotal] = await Promise.all([
    QuizAttempt.countDocuments({ submittedAt: { $gte: from }, passed: true }),
    QuizAttempt.countDocuments({ submittedAt: { $gte: from, $ne: null } }),
    ExamAttempt.countDocuments({ submittedAt: { $gte: from }, passed: true }),
    ExamAttempt.countDocuments({ submittedAt: { $gte: from, $ne: null } }),
  ]);
  const samples = quizTotal + examTotal;
  const quizPassRatePercent = quizTotal === 0 ? 0 : Math.round((quizPassed / quizTotal) * 100);
  const examPassRatePercent = examTotal === 0 ? 0 : Math.round((examPassed / examTotal) * 100);
  return { quizPassRatePercent, examPassRatePercent, samples };
}

async function slaBreachesThisWeek(now: Date) {
  const monday = startOfUtcDay(now);
  const dayOfWeek = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - dayOfWeek);
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);

  const breaches = await Ticket.find({
    $or: [
      { slaAckBreachedAt: { $gte: monday, $lt: nextMonday } },
      { slaResolveBreachedAt: { $gte: monday, $lt: nextMonday } },
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
      (t.slaAckBreachedAt && t.slaAckBreachedAt >= monday && t.slaAckBreachedAt < nextMonday)
      || (t.slaResolveBreachedAt
        && t.slaResolveBreachedAt >= monday
        && t.slaResolveBreachedAt < nextMonday);
    if (bumped) {
      thisWeek += 1;
      byCategory[t.category as TicketCategory] += 1;
    }
  }
  return { thisWeek, byCategory };
}

async function feedbackCoverage(now: Date) {
  const from = daysAgo(now, 7);
  const [publishedLast7d, submittedLast7d] = await Promise.all([
    FeedbackEntry.countDocuments({ status: 'published', publishedAt: { $gte: from } }),
    ExamAttempt.countDocuments({ submittedAt: { $gte: from } }),
  ]);
  const coveragePercent =
    submittedLast7d === 0
      ? 0
      : Math.round((publishedLast7d / submittedLast7d) * 100);
  return { coveragePercent, publishedLast7d };
}

async function apiCostThisMonth(now: Date) {
  const rows = await ApiCostLedger.aggregate<{
    _id: string;
    units: number;
    totalPaise: number;
  }>([
    { $match: { atUtc: { $gte: startOfMonth(now) } } },
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

async function sparklineFor(
  now: Date,
  model: typeof User,
  dateField: string,
  match: Record<string, unknown>,
): Promise<{ days: string[]; values: number[] }> {
  const days: string[] = [];
  const values: number[] = new Array(14).fill(0);
  const earliest = daysAgo(now, 13);
  const rows = await (model as unknown as {
    aggregate: (pipe: unknown[]) => Promise<Array<{ _id: string; c: number }>>;
  }).aggregate([
    { $match: { ...match, [dateField]: { $gte: earliest, $lt: endOfUtcDay(now) } } },
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
  for (let i = 13; i >= 0; i -= 1) {
    const day = daysAgo(now, i);
    const key = day.toISOString().slice(0, 10);
    days.push(key);
    values[13 - i] = counts.get(key) ?? 0;
  }
  return { days, values };
}

async function feesSparkline(now: Date): Promise<{ days: string[]; values: number[] }> {
  const earliest = daysAgo(now, 13);
  const rows = await Payment.aggregate<{ _id: string; total: number }>([
    {
      $match: {
        reversed: false,
        receivedAt: { $gte: earliest, $lt: endOfUtcDay(now) },
      },
    },
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
  const days: string[] = [];
  const values: number[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = daysAgo(now, i);
    const key = day.toISOString().slice(0, 10);
    days.push(key);
    values.push(sums.get(key) ?? 0);
  }
  return { days, values };
}

async function slaBreachSparkline(now: Date) {
  const earliest = daysAgo(now, 13);
  // Union of ack + resolve breaches by day.
  const rows = await Ticket.aggregate<{ _id: string; c: number }>([
    {
      $match: {
        $or: [
          { slaAckBreachedAt: { $gte: earliest, $lt: endOfUtcDay(now) } },
          { slaResolveBreachedAt: { $gte: earliest, $lt: endOfUtcDay(now) } },
        ],
      },
    },
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
  const days: string[] = [];
  const values: number[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = daysAgo(now, i);
    const key = day.toISOString().slice(0, 10);
    days.push(key);
    values.push(counts.get(key) ?? 0);
  }
  return { days, values };
}

export interface GetSummaryOptions {
  bypassCache?: boolean;
}

export async function getAnalyticsSummary(
  options: GetSummaryOptions = {},
): Promise<AnalyticsSummaryDto> {
  const now = nowUtc();
  if (!options.bypassCache && summaryCache && summaryCache.expiresAt > now.getTime()) {
    return summaryCache.value;
  }

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
    studentsByStatus(now),
    admissionsCounts(now),
    feesTotals(now),
    assessmentsPassRate(now),
    slaBreachesThisWeek(now),
    feedbackCoverage(now),
    apiCostThisMonth(now),
    sparklineFor(now, Enrollment as unknown as typeof User, 'createdAt', {}),
    feesSparkline(now),
    slaBreachSparkline(now),
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
  summaryCache = { expiresAt: now.getTime() + SUMMARY_TTL_MS, value };
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
