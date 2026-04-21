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
} from '../helpers/factories.js';

describe('ticket listing endpoints', () => {
  useMongo();
  useIntegrationSpies();

  it('/v1/me/tickets and /v1/tickets/me return the same tickets for the student', async () => {
    const { user: student } = await makeStudent();
    await makeTicket({ studentId: student._id, subject: 'A' });
    await makeTicket({ studentId: student._id, subject: 'B' });
    const at = await tokenFor(student);
    const a = await http().get('/v1/me/tickets').set(bearer(at));
    const b = await http().get('/v1/tickets/me').set(bearer(at));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const codesA = a.body.data.tickets.map((t: { code: string }) => t.code).sort();
    const codesB = b.body.data.tickets.map((t: { code: string }) => t.code).sort();
    expect(codesA).toEqual(codesB);
    expect(codesA.length).toBe(2);
  });

  it('/v1/staff/tickets shows faculty assignees + academic queue', async () => {
    const { user: student } = await makeStudent();
    const { user: faculty } = await makeFaculty();
    const { user: other } = await makeFaculty();
    await makeTicket({
      studentId: student._id,
      assigneeUserId: faculty._id,
      category: 'academic',
    });
    await makeTicket({
      studentId: student._id,
      assigneeUserId: other._id,
      category: 'academic',
    });
    const at = await tokenFor(faculty);
    const res = await http().get('/v1/staff/tickets').set(bearer(at));
    expect(res.status).toBe(200);
    // Faculty sees academic-category queue by default (both tickets).
    expect(res.body.data.tickets.length).toBe(2);
  });

  it('/v1/tickets (admin list) supports ?slaBreached=any', async () => {
    const { user: student } = await makeStudent();
    const { user: admin } = await makeAdmin();
    await makeTicket({ studentId: student._id, slaAckBreached: true });
    await makeTicket({ studentId: student._id });
    const at = await tokenFor(admin);
    const res = await http()
      .get('/v1/tickets?slaBreached=any')
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.tickets.length).toBe(1);
    expect(res.body.data.tickets[0].slaAckBreached).toBe(true);
  });

  it('/v1/tickets blocks student (403)', async () => {
    const { user: student } = await makeStudent();
    const at = await tokenFor(student);
    const res = await http().get('/v1/tickets').set(bearer(at));
    expect(res.status).toBe(403);
  });
});
