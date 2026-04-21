import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeFaculty,
  makeStudent,
  makeTicket,
  makeUser,
} from '../helpers/factories.js';

async function seedRouting(): Promise<void> {
  const { user: faculty } = await makeFaculty();
  faculty.isCourseCoordinator = true;
  await faculty.save();
  await makeUser({ role: 'finance' });
  await makeUser({ role: 'superadmin' });
}

describe('POST /v1/tickets', () => {
  useMongo();
  useIntegrationSpies();

  it('student creates an academic ticket → code, state, notification', async () => {
    await seedRouting();
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'academic',
        subject: 'Video issue',
        description: 'Playback stuck',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.code).toMatch(/^TKT-ACAD-\d{6}$/);
    expect(res.body.data.ticket.state).toBe('assigned');
    expect(res.body.data.ticket.studentId).toBe(String(student._id));
    expect(res.body.data.ticket.slaAckDeadline).toBeTruthy();
    expect(res.body.data.ticket.slaResolveDeadline).toBeTruthy();
  });

  it('rejects complaint from a student with no prior resolved/closed ticket (409)', async () => {
    await seedRouting();
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'complaints',
        subject: 'Escalation',
        description: 'Need review',
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COMPLAINT_PRECONDITION_UNMET');
  });

  it('allows complaint once a closed ticket exists', async () => {
    await seedRouting();
    const { user: student } = await makeStudent();
    await makeTicket({
      studentId: student._id,
      state: 'closed',
      closedAt: new Date(),
    });
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'complaints',
        subject: 'Escalation',
        description: 'Review',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.code).toMatch(/^TKT-CMPL-\d{6}$/);
    expect(res.body.data.ticket.priority).toBe('urgent');
  });

  it('admin cannot POST /v1/tickets (403)', async () => {
    await seedRouting();
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'academic',
        subject: 'x',
        description: 'y',
      });
    expect(res.status).toBe(403);
  });

  it('rejects missing subject/description via zod (422)', async () => {
    await seedRouting();
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'academic',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
