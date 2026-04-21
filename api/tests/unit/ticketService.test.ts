import { afterEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { Role } from 'india-learns-shared-types';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeTicket,
  makeUser,
} from '../helpers/factories.js';
import {
  addComment,
  createTicket,
  reopenTicket,
  requestReopen,
  transitionTicket,
} from '../../src/services/ticketService.js';
import type { AuthContext } from '../../src/middleware/auth.js';
import { Ticket, User, type UserDoc } from '../../src/models/index.js';
import {
  resetClock,
  setTestNow,
} from '../../src/services/clockService.js';

function contextFor(user: UserDoc, role?: Role): AuthContext {
  return {
    userId: user._id,
    role: (role ?? user.role) as Role,
    status: user.status,
    user: user as unknown as AuthContext['user'],
  };
}

describe('ticketService', () => {
  useMongo();
  useIntegrationSpies();

  afterEach(() => {
    resetClock();
  });

  async function seedRoutingSet(): Promise<{ faculty: UserDoc }> {
    const faculty = await makeUser({ role: 'faculty' });
    faculty.isCourseCoordinator = true;
    await faculty.save();
    return { faculty };
  }

  it('createTicket rejects a complaint without a prior resolved/closed ticket', async () => {
    const student = await makeUser({ role: 'student' });
    await seedRoutingSet();
    await expect(
      createTicket(
        contextFor(student),
        {
          category: 'complaints',
          subject: 'Grading concern',
          description: 'Wanted to escalate.',
        },
        { actorUserId: student._id },
      ),
    ).rejects.toMatchObject({ code: 'COMPLAINT_PRECONDITION_UNMET', status: 409 });
  });

  it('createTicket allows a complaint once a closed ticket exists', async () => {
    const student = await makeUser({ role: 'student' });
    await seedRoutingSet();
    await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
    });
    const ticket = await createTicket(
      contextFor(student),
      {
        category: 'complaints',
        subject: 'Grading concern',
        description: 'Wanted to escalate.',
      },
      { actorUserId: student._id },
    );
    expect(ticket.category).toBe('complaints');
    expect(ticket.code).toMatch(/^TKT-CMPL-\d{6}$/);
    expect(ticket.priority).toBe('urgent');
  });

  it('createTicket rejects non-students', async () => {
    const admin = await makeUser({ role: 'admin' });
    await expect(
      createTicket(
        contextFor(admin),
        {
          category: 'academic',
          subject: 'X',
          description: 'Y',
        },
        { actorUserId: admin._id },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('createTicket computes SLA deadlines — 5 calendar days for standard, 15 bd for complaints', async () => {
    const nowAnchor = new Date('2026-07-06T04:00:00.000Z'); // Monday IST
    setTestNow(nowAnchor);
    const student = await makeUser({ role: 'student' });
    const faculty = await makeUser({ role: 'faculty' });
    faculty.isCourseCoordinator = true;
    await faculty.save();

    const academic = await createTicket(
      contextFor(student),
      { category: 'academic', subject: 'x', description: 'y' },
      { actorUserId: student._id },
    );
    // Deadlines are computed against the injected clock, not mongoose's
    // wall-clock timestamps, so anchor the assertions on `nowAnchor`.
    const ackDelta = academic.slaAckDeadline.getTime() - nowAnchor.getTime();
    expect(Math.round(ackDelta / 3_600_000)).toBe(24);
    const resolveDelta = academic.slaResolveDeadline.getTime() - nowAnchor.getTime();
    expect(Math.round(resolveDelta / 86_400_000)).toBe(5);

    await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
    });
    const complaint = await createTicket(
      contextFor(student),
      { category: 'complaints', subject: 'escalation', description: 'z' },
      { actorUserId: student._id },
    );
    // 15 bd from Monday 2026-07-06 with no holidays lands Monday 2026-07-27
    // (Saturdays/Sundays skipped) — 21 calendar days later.
    const days = Math.round(
      (complaint.slaResolveDeadline.getTime() - nowAnchor.getTime())
      / 86_400_000,
    );
    expect(days).toBe(21);
  });

  it('transitionTicket rejects illegal edges (open → closed)', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const t = await makeTicket({ studentId: student._id });
    await expect(
      transitionTicket(contextFor(admin), String(t._id), 'closed', undefined, {
        actorUserId: admin._id,
      }),
    ).rejects.toMatchObject({ code: 'TICKET_STATE_INVALID' });
  });

  it('transitionTicket allows resolved → closed → reopen inside 7-day window', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const t = await makeTicket({
      studentId: student._id,
      state: 'in_progress',
      assigneeUserId: admin._id,
    });
    const resolved = await transitionTicket(
      contextFor(admin),
      String(t._id),
      'resolved',
      'Fixed.',
      { actorUserId: admin._id },
    );
    expect(resolved.state).toBe('resolved');
    expect(resolved.resolutionNote).toBe('Fixed.');
    const closed = await transitionTicket(
      contextFor(admin),
      String(t._id),
      'closed',
      undefined,
      { actorUserId: admin._id },
    );
    expect(closed.state).toBe('closed');

    setTestNow(new Date(Date.now() + 6 * 86_400_000));
    const reopened = await reopenTicket(
      contextFor(admin),
      String(t._id),
      'More info needed',
      { actorUserId: admin._id },
    );
    expect(reopened.state).toBe('in_progress');
    expect(reopened.reopenedAt).toBeTruthy();
    expect(reopened.closedAt).toBeNull();
  });

  it('reopenTicket beyond 7 days throws REOPEN_WINDOW_EXPIRED', async () => {
    const student = await makeUser({ role: 'student' });
    const admin = await makeUser({ role: 'admin' });
    const closedAt = new Date();
    const t = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt,
      resolvedAt: closedAt,
    });
    setTestNow(new Date(closedAt.getTime() + 8 * 86_400_000));
    await expect(
      reopenTicket(contextFor(admin), String(t._id), 'late', {
        actorUserId: admin._id,
      }),
    ).rejects.toMatchObject({ code: 'REOPEN_WINDOW_EXPIRED', status: 409 });
  });

  it('requestReopen creates a child ticket with parentTicketId', async () => {
    const student = await makeUser({ role: 'student' });
    await seedRoutingSet();
    const parent = await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
      subject: 'original issue',
      category: 'academic',
    });
    const child = await requestReopen(
      contextFor(student),
      String(parent._id),
      'Still happening',
      { actorUserId: student._id },
    );
    expect(child.parentTicketId?.toString()).toBe(parent._id.toString());
    expect(child.category).toBe('academic');
    expect(child.subject.startsWith('Re: ')).toBe(true);
    expect(child.studentId.toString()).toBe(student._id.toString());
  });

  it('requestReopen rejects when caller is not the owner', async () => {
    const student = await makeUser({ role: 'student' });
    const other = await makeUser({ role: 'student' });
    const parent = await makeTicket({
      studentId: other._id,
      state: 'closed',
      closedAt: new Date(),
    });
    await expect(
      requestReopen(contextFor(student), String(parent._id), 'nope', {
        actorUserId: student._id,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('student addComment is forced to visibility=public and blocked on resolved tickets', async () => {
    const student = await makeUser({ role: 'student' });
    const t = await makeTicket({
      studentId: student._id,
      state: 'in_progress',
    });
    const comment = await addComment(
      contextFor(student),
      String(t._id),
      { body: 'please update', visibility: 'internal' },
      { actorUserId: student._id },
    );
    expect(comment.visibility).toBe('public');

    await Ticket.updateOne({ _id: t._id }, { $set: { state: 'resolved', resolvedAt: new Date() } });
    await expect(
      addComment(
        contextFor(student),
        String(t._id),
        { body: 'again' },
        { actorUserId: student._id },
      ),
    ).rejects.toMatchObject({ code: 'TICKET_STATE_INVALID', status: 409 });
  });

  it('first public staff comment sets firstAckAt and transitions open → assigned', async () => {
    const student = await makeUser({ role: 'student' });
    const faculty = await makeUser({ role: 'faculty' });
    const t = await makeTicket({
      studentId: student._id,
      state: 'open',
    });
    const comment = await addComment(
      contextFor(faculty),
      String(t._id),
      { body: 'looking into it' },
      { actorUserId: faculty._id },
    );
    expect(comment.visibility).toBe('public');
    const fresh = await Ticket.findById(t._id);
    expect(fresh?.firstAckAt).toBeTruthy();
    expect(fresh?.state).toBe('assigned');
    expect(fresh?.assigneeUserId?.toString()).toBe(faculty._id.toString());
  });

  it('internal staff comment does NOT set firstAckAt', async () => {
    const student = await makeUser({ role: 'student' });
    const faculty = await makeUser({ role: 'faculty' });
    const t = await makeTicket({
      studentId: student._id,
      state: 'open',
    });
    const comment = await addComment(
      contextFor(faculty),
      String(t._id),
      { body: 'internal note', visibility: 'internal' },
      { actorUserId: faculty._id },
    );
    expect(comment.visibility).toBe('internal');
    const fresh = await Ticket.findById(t._id);
    expect(fresh?.firstAckAt).toBeNull();
    expect(fresh?.state).toBe('open');
  });

  it('ticket code uses the category prefix', async () => {
    const student = await makeUser({ role: 'student' });
    const fin = await makeUser({ role: 'finance' });
    const ticket = await createTicket(
      contextFor(student),
      { category: 'finance', subject: 's', description: 'd' },
      { actorUserId: student._id },
    );
    expect(ticket.code).toMatch(/^TKT-FIN-\d{6}$/);
    expect(ticket.assigneeUserId?.toString()).toBe(fin._id.toString());
  });

  it('ticket rejects unknown id', async () => {
    const admin = await makeUser({ role: 'admin' });
    const fakeId = new Types.ObjectId();
    await expect(
      transitionTicket(contextFor(admin), String(fakeId), 'in_progress', undefined, {
        actorUserId: admin._id,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('User.create is still usable after the ticket flow', async () => {
    // Sanity: ensure no mongoose model overwrites after the ticket model
    // registers. Guards against D-018 regressions.
    const u = await User.create({
      role: 'student',
      name: 'late',
      email: `late-${Date.now()}@test.local`,
      phoneE164: '+919999999999',
      status: 'active',
    });
    expect(u._id).toBeTruthy();
  });
});
