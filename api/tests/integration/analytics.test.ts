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
  makeUser,
} from '../helpers/factories.js';
import { clearAnalyticsCache } from '../../src/services/analyticsService.js';

describe('/v1/analytics', () => {
  useMongo();
  useIntegrationSpies();

  it('GET /summary returns the seven PRD §15 widgets for admin', async () => {
    const { user: admin } = await makeAdmin();
    const token = await tokenFor(admin);
    clearAnalyticsCache();
    const res = await http().get('/v1/analytics/summary').set(bearer(token));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.students).toBeDefined();
    expect(d.admissions).toBeDefined();
    expect(d.fees).toBeDefined();
    expect(d.assessments).toBeDefined();
    expect(d.slaBreaches).toBeDefined();
    expect(d.feedback).toBeDefined();
    expect(d.apiCost).toBeDefined();
    expect(Array.isArray(d.sparklines.students.values)).toBe(true);
    expect(d.sparklines.students.values).toHaveLength(14);
  });

  it('GET /summary 403 for student / faculty (M10r — finance role removed)', async () => {
    for (const seed of [makeStudent, makeFaculty]) {
      const { user } = await seed();
      const token = await tokenFor(user);
      const res = await http().get('/v1/analytics/summary').set(bearer(token));
      expect(res.status).toBe(403);
    }
  });

  it('GET /summary allowed for superadmin (read-only)', async () => {
    const superadmin = await makeUser({ role: 'superadmin' });
    const token = await tokenFor(superadmin);
    clearAnalyticsCache();
    const res = await http().get('/v1/analytics/summary').set(bearer(token));
    expect(res.status).toBe(200);
  });

  it('GET /collections?from=&to= returns 200 with totalPaise', async () => {
    const { user: admin } = await makeAdmin();
    const token = await tokenFor(admin);
    const from = new Date('2026-04-01T00:00:00Z').toISOString();
    const to = new Date('2026-05-01T00:00:00Z').toISOString();
    const res = await http()
      .get(`/v1/analytics/collections?from=${from}&to=${to}`)
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.totalPaise).toBe('number');
    expect(Array.isArray(res.body.data.rows)).toBe(true);
  });

  it('GET /sla-breaches?week=YYYY-Www rejects malformed week', async () => {
    const { user: admin } = await makeAdmin();
    const token = await tokenFor(admin);
    const res = await http()
      .get('/v1/analytics/sla-breaches?week=April')
      .set(bearer(token));
    expect(res.status).toBe(422);
  });

  it('GET /sla-breaches?week=2026-W18 returns report shape', async () => {
    const { user: admin } = await makeAdmin();
    const token = await tokenFor(admin);
    const res = await http()
      .get('/v1/analytics/sla-breaches?week=2026-W18')
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.week).toBe('2026-W18');
    expect(Array.isArray(res.body.data.byCategory)).toBe(true);
  });
});
