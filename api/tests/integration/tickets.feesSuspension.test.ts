import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeStudent,
  makeTicket,
  makeUser,
} from '../helpers/factories.js';

async function asFeesSuspendedStudent() {
  const { user } = await makeStudent();
  user.status = 'suspended';
  user.suspensionKind = 'fees';
  await user.save();
  await makeUser({ role: 'finance' });
  return user;
}

describe('fees-suspended students and tickets', () => {
  useMongo();
  useIntegrationSpies();

  it('can POST /v1/tickets with category=finance', async () => {
    const student = await asFeesSuspendedStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'finance',
        subject: 'Refund question',
        description: 'About the reversal',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.ticket.code).toMatch(/^TKT-FIN-\d{6}$/);
  });

  it('cannot POST /v1/tickets with category=academic (403 FEES_SUSPENDED)', async () => {
    const student = await asFeesSuspendedStudent();
    const at = await tokenFor(student);
    const res = await http()
      .post('/v1/tickets')
      .set(bearer(at))
      .send({
        category: 'academic',
        subject: 'Help',
        description: 'x',
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEES_SUSPENDED');
  });

  it('can GET /v1/me/tickets while suspended', async () => {
    const student = await asFeesSuspendedStudent();
    await makeTicket({ studentId: student._id, category: 'finance' });
    const at = await tokenFor(student);
    const res = await http().get('/v1/me/tickets').set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.tickets.length).toBe(1);
  });
});
