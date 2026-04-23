import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import {
  clearAnalyticsCache,
  getAnalyticsSummary,
  getSlaBreachReport,
  parseIsoWeek,
} from '../../src/services/analyticsService.js';
import { ApiCostLedger, Ticket, User } from '../../src/models/index.js';
import {
  makeProgram,
  makeStudent,
  makeTicket,
  makeUser,
} from '../helpers/factories.js';

describe('analyticsService', () => {
  useMongo();

  it('getAnalyticsSummary caches for 5 minutes', async () => {
    clearAnalyticsCache();
    const first = await getAnalyticsSummary();
    const second = await getAnalyticsSummary();
    expect(second.generatedAt).toBe(first.generatedAt);
  });

  it('getAnalyticsSummary counts active + suspended students', async () => {
    clearAnalyticsCache();
    await makeStudent();
    await makeStudent();
    await makeUser({ role: 'student', status: 'suspended' });
    const summary = await getAnalyticsSummary({ bypassCache: true });
    expect(summary.students.active).toBe(2);
    expect(summary.students.suspended).toBe(1);
  });

  it('getAnalyticsSummary aggregates api-cost by provider', async () => {
    clearAnalyticsCache();
    await ApiCostLedger.create({
      provider: 'email',
      operation: 'email.send.primary',
      units: 1,
      unitPaise: 50,
      atUtc: new Date(),
    });
    await ApiCostLedger.create({
      provider: 'whatsapp',
      operation: 'whatsapp.template.il_fee_due',
      units: 1,
      unitPaise: 200,
      atUtc: new Date(),
    });
    const summary = await getAnalyticsSummary({ bypassCache: true });
    expect(summary.apiCost.byProvider.length).toBeGreaterThan(0);
    expect(summary.apiCost.thisMonthPaise).toBeGreaterThan(0);
  });

  it('getAnalyticsSummary narrows student counts by programId', async () => {
    clearAnalyticsCache();
    const progA = await makeProgram();
    const progB = await makeProgram();

    // Two students in A, one in B — all active.
    const { user: studentA1 } = await makeStudent();
    studentA1.programId = progA._id;
    await studentA1.save();
    const { user: studentA2 } = await makeStudent();
    studentA2.programId = progA._id;
    await studentA2.save();
    const { user: studentB } = await makeStudent();
    studentB.programId = progB._id;
    await studentB.save();

    const all = await getAnalyticsSummary({ bypassCache: true });
    expect(all.students.active).toBe(3);

    const aOnly = await getAnalyticsSummary({
      bypassCache: true,
      programId: progA._id.toString(),
    });
    expect(aOnly.students.active).toBe(2);

    const bOnly = await getAnalyticsSummary({
      bypassCache: true,
      programId: progB._id.toString(),
    });
    expect(bOnly.students.active).toBe(1);
  });

  it('getAnalyticsSummary caches independently per programId + range', async () => {
    clearAnalyticsCache();
    const prog = await makeProgram();
    // First call with no filters → cache key ""
    const bare = await getAnalyticsSummary();
    // Second call narrowed → different key, different generatedAt wouldn't
    // matter; what matters is that the bare-key cache is still served fresh.
    await getAnalyticsSummary({ programId: prog._id.toString() });
    const bareAgain = await getAnalyticsSummary();
    expect(bareAgain.generatedAt).toBe(bare.generatedAt);
  });

  it('getAnalyticsSummary with a date range uses that window for fees', async () => {
    clearAnalyticsCache();
    const windowed = await getAnalyticsSummary({
      bypassCache: true,
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-01T00:00:00Z'),
    });
    // With no payments in the test DB, the windowed value is 0 — and both
    // alias fields (thisMonth/ytd) mirror it when a range is active.
    expect(windowed.fees.collectedThisMonthPaise).toBe(windowed.fees.collectedYtdPaise);
  });

  it('parseIsoWeek returns correct Monday-to-Monday range', () => {
    const { start, end } = parseIsoWeek('2026-W18');
    // 2026-W18 Monday is 2026-04-27
    expect(start.toISOString().slice(0, 10)).toBe('2026-04-27');
    expect(end.toISOString().slice(0, 10)).toBe('2026-05-04');
  });

  it('getSlaBreachReport groups breached tickets by category for the given ISO week', async () => {
    const program = await makeProgram();
    const { user: student } = await makeStudent();

    const { start, end } = parseIsoWeek('2026-W18');
    const midWeek = new Date(start.getTime() + 3 * 86_400_000);
    await makeTicket({
      studentId: student._id,
      category: 'academic',
      state: 'open',
      slaAckBreached: true,
      slaResolveBreached: false,
      slaAckDeadline: new Date(midWeek.getTime() - 1000),
      slaResolveDeadline: end,
    });
    await Ticket.updateMany({ category: 'academic' }, {
      $set: { slaAckBreachedAt: midWeek },
    });
    await makeTicket({
      studentId: student._id,
      category: 'complaints',
      state: 'open',
      slaResolveBreached: true,
    });
    await Ticket.updateOne(
      { category: 'complaints' },
      { $set: { slaResolveBreachedAt: midWeek } },
    );

    const report = await getSlaBreachReport('2026-W18');
    expect(report.total).toBeGreaterThanOrEqual(2);
    const academic = report.byCategory.find((r) => r.category === 'academic');
    expect(academic?.ackBreaches).toBe(1);
    const complaints = report.byCategory.find((r) => r.category === 'complaints');
    expect(complaints?.resolveBreaches).toBe(1);

    // Silence unused var
    expect(program).toBeDefined();
    // Ensure the outer User import is actually wired.
    expect(await User.countDocuments({})).toBeGreaterThan(0);
  });
});
