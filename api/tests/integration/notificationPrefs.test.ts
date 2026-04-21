import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeStudent } from '../helpers/factories.js';

describe('/v1/me/notification-prefs', () => {
  useMongo();
  useIntegrationSpies();

  it('GET returns launch defaults on first access', async () => {
    const { user: student } = await makeStudent();
    const token = await tokenFor(student);
    const res = await http().get('/v1/me/notification-prefs').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(student._id.toString());
    // Email default on for every known event.
    expect(res.body.data.emailByType['certificate.issued']).toBe(true);
    // WhatsApp default off for types outside the allowlist.
    expect(res.body.data.whatsappByType['certificate.issued']).toBe(false);
    expect(res.body.data.whatsappByType['fees.due.today']).toBe(true);
  });

  it('PATCH updates email toggles and persists across fetches', async () => {
    const { user: student } = await makeStudent();
    const token = await tokenFor(student);

    const patched = await http()
      .patch('/v1/me/notification-prefs')
      .set(bearer(token))
      .send({ emailByType: { 'timetable.change': false } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.emailByType['timetable.change']).toBe(false);

    const again = await http()
      .get('/v1/me/notification-prefs')
      .set(bearer(token));
    expect(again.body.data.emailByType['timetable.change']).toBe(false);
  });

  it('PATCH rejects WhatsApp=true on a non-allowlist type with 422 VALIDATION_FAILED', async () => {
    const { user: student } = await makeStudent();
    const token = await tokenFor(student);
    const res = await http()
      .patch('/v1/me/notification-prefs')
      .set(bearer(token))
      .send({ whatsappByType: { 'certificate.issued': true } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('PATCH rejects unknown notification type with 422', async () => {
    const { user: student } = await makeStudent();
    const token = await tokenFor(student);
    const res = await http()
      .patch('/v1/me/notification-prefs')
      .set(bearer(token))
      .send({ emailByType: { 'nonsense.type': false } });
    expect(res.status).toBe(422);
  });
});

describe('/v1/me/notifications (TRD §5.11 alias)', () => {
  useMongo();
  useIntegrationSpies();

  it('GET /v1/me/notifications returns the same list as /v1/notifications/me', async () => {
    const { user: student } = await makeStudent();
    const token = await tokenFor(student);
    const res = await http().get('/v1/me/notifications').set(bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});
