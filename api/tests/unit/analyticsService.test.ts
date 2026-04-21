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
