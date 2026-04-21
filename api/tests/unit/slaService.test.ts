import { afterEach, describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeTicket, makeUser } from '../helpers/factories.js';
import { computeBreaches } from '../../src/services/slaService.js';
import { resetClock, setTestNow } from '../../src/services/clockService.js';
import { Ticket } from '../../src/models/index.js';

describe('slaService.computeBreaches', () => {
  useMongo();
  const spies = useIntegrationSpies();

  afterEach(() => {
    resetClock();
  });

  it('flips ack breach once and is idempotent on a second run', async () => {
    const student = await makeUser({ role: 'student' });
    const assignee = await makeUser({ role: 'faculty' });
    const admin = await makeUser({ role: 'admin' });
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    const t = await makeTicket({
      studentId: student._id,
      assigneeUserId: assignee._id,
      state: 'assigned',
      slaAckDeadline: new Date(now.getTime() - 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() + 5 * 86_400_000),
    });

    const first = await computeBreaches(now);
    expect(first.ackBreached).toBe(1);
    expect(first.resolveBreached).toBe(0);

    const refetched = await Ticket.findById(t._id);
    expect(refetched?.slaAckBreached).toBe(true);
    expect(refetched?.slaAckBreachedAt).toBeTruthy();

    const second = await computeBreaches(now);
    expect(second.ackBreached).toBe(0);

    // Two distinct recipients (assignee + admin pool) should receive email.
    const emailTargets = new Set(spies.email.calls.map((c) => c.to));
    expect(emailTargets.has(assignee.email)).toBe(true);
    expect(emailTargets.has(admin.email)).toBe(true);
  });

  it('flips resolve breach when resolve deadline has passed', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    await makeTicket({
      studentId: student._id,
      assigneeUserId: admin._id,
      state: 'in_progress',
      firstAckAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      slaAckDeadline: new Date(now.getTime() + 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() - 60 * 60 * 1000),
    });
    const result = await computeBreaches(now);
    expect(result.resolveBreached).toBe(1);
  });

  it('does not flip ack breach if firstAckAt is set (SLA met in time)', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    await makeTicket({
      studentId: student._id,
      assigneeUserId: admin._id,
      state: 'in_progress',
      firstAckAt: new Date(now.getTime() - 10 * 60 * 60 * 1000),
      slaAckDeadline: new Date(now.getTime() - 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() + 5 * 86_400_000),
    });
    const result = await computeBreaches(now);
    expect(result.ackBreached).toBe(0);
  });

  it('skips tickets in terminal states', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const now = new Date('2026-07-06T04:00:00.000Z');
    setTestNow(now);
    await makeTicket({
      studentId: student._id,
      assigneeUserId: admin._id,
      state: 'resolved',
      resolvedAt: new Date(now.getTime() - 60 * 60 * 1000),
      slaAckDeadline: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      slaResolveDeadline: new Date(now.getTime() - 60 * 60 * 1000),
    });
    const result = await computeBreaches(now);
    expect(result.processed).toBe(0);
    expect(result.ackBreached).toBe(0);
    expect(result.resolveBreached).toBe(0);
  });
});
