import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeStudent } from '../helpers/factories.js';

// M10s — Visitor Leads admin CRUD smoke. Service-layer validation + the
// audit chain are exercised through the route surface.

describe('POST /v1/visitor-leads', () => {
  useMongo();
  useIntegrationSpies();

  it('admin creates a visitor lead', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/visitor-leads')
      .set(bearer(at))
      .send({
        firstName: 'Athira',
        lastName: 'Sharma',
        highestQualification: 'graduate',
        phoneE164: '+919876543210',
        email: 'athira@example.com',
        leadSource: 'meta',
        socialMediaId: '@athira',
        notes: 'Met at the Fashion expo',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.lead.firstName).toBe('Athira');
    expect(res.body.data.lead.leadSource).toBe('meta');
    expect(res.body.data.lead.otpVerificationStatus).toBe('pending');
    expect(res.body.data.lead.status).toBe('new');
  });

  it('accepts a bare 10-digit phone and stores it as +91 E.164', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/visitor-leads')
      .set(bearer(at))
      .send({
        firstName: 'Josmy',
        lastName: 'Jaimon',
        phoneE164: '9249551757', // exactly what staff type — no + / country code
        leadSource: 'walk_in',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.lead.phoneE164).toBe('+919249551757');
  });

  it('rejects duplicate phone on active leads with 409', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const body = {
      firstName: 'A',
      lastName: 'B',
      phoneE164: '+919999999999',
      leadSource: 'walk_in',
    };
    const first = await http().post('/v1/visitor-leads').set(bearer(at)).send(body);
    expect(first.status).toBe(201);
    const dup = await http().post('/v1/visitor-leads').set(bearer(at)).send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('LEAD_EXISTS');
  });

  it('student 403 on create', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http()
      .post('/v1/visitor-leads')
      .set(bearer(at))
      .send({ firstName: 'X', lastName: 'Y', phoneE164: '+911111111111', leadSource: 'other' });
    expect(res.status).toBe(403);
  });

  it('list + patch + soft-delete cycle', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const created = await http()
      .post('/v1/visitor-leads')
      .set(bearer(at))
      .send({ firstName: 'L', lastName: 'M', phoneE164: '+918888888888', leadSource: 'google' });
    expect(created.status).toBe(201);
    const id = created.body.data.lead.id as string;

    const list = await http().get('/v1/visitor-leads').set(bearer(at));
    expect(list.status).toBe(200);
    expect(list.body.data.items.length).toBe(1);

    const patched = await http()
      .patch(`/v1/visitor-leads/${id}`)
      .set(bearer(at))
      .send({ status: 'qualified', otpVerificationStatus: 'verified' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.lead.status).toBe('qualified');
    expect(patched.body.data.lead.otpVerificationStatus).toBe('verified');

    const del = await http().delete(`/v1/visitor-leads/${id}`).set(bearer(at));
    expect(del.status).toBe(200);
    expect(del.body.data.lead.deletedAt).not.toBeNull();
    expect(del.body.data.lead.status).toBe('dropped');

    // Soft-deleted leads disappear from list.
    const listAfter = await http().get('/v1/visitor-leads').set(bearer(at));
    expect(listAfter.body.data.items.length).toBe(0);

    // Phone is freed for re-capture.
    const reused = await http()
      .post('/v1/visitor-leads')
      .set(bearer(at))
      .send({ firstName: 'L2', lastName: 'M2', phoneE164: '+918888888888', leadSource: 'google' });
    expect(reused.status).toBe(201);
  });

  it('search by q matches name / email / phone', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    await http().post('/v1/visitor-leads').set(bearer(at)).send({
      firstName: 'Raghav', lastName: 'Nair', phoneE164: '+917000000001', leadSource: 'agent',
      email: 'raghav@example.com',
    });
    await http().post('/v1/visitor-leads').set(bearer(at)).send({
      firstName: 'Other', lastName: 'Person', phoneE164: '+917000000002', leadSource: 'agent',
    });
    const r1 = await http().get('/v1/visitor-leads?q=Raghav').set(bearer(at));
    expect(r1.body.data.items.length).toBe(1);
    const r2 = await http().get('/v1/visitor-leads?q=raghav@example').set(bearer(at));
    expect(r2.body.data.items.length).toBe(1);
    const r3 = await http().get('/v1/visitor-leads?q=70000000').set(bearer(at));
    expect(r3.body.data.items.length).toBe(2);
  });
});
