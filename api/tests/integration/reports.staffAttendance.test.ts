import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeFaculty } from '../helpers/factories.js';
import { StaffAttendance } from '../../src/models/index.js';

// Q-M10-followup-faculty-staff — staff-attendance roll-up in Reports.
// Faculty self-mark on AdminStaffAttendance; admin override there too.
// This Reports tab aggregates those rows over a date window.
describe('GET /v1/reports/staff-attendance', () => {
  useMongo();
  useIntegrationSpies();

  async function seedRows() {
    const { user: admin } = await makeAdmin();
    const { user: facA } = await makeFaculty();
    const { user: facB } = await makeFaculty();

    const today = new Date('2026-05-15T00:00:00.000Z');
    const yesterday = new Date('2026-05-14T00:00:00.000Z');
    const dayBefore = new Date('2026-05-13T00:00:00.000Z');
    // Anita: present, present, late → rate (2 + 0.5×0) / 3 = 66.7 (late counts full)
    // Actually rate weights: present + late + half_day*0.5 → 2 + 1 = 3 / 3 = 100%
    await StaffAttendance.create([
      { userId: facA._id, date: today, status: 'present', notes: null, markedByUserId: facA._id, markedAt: today },
      { userId: facA._id, date: yesterday, status: 'present', notes: null, markedByUserId: facA._id, markedAt: yesterday },
      { userId: facA._id, date: dayBefore, status: 'late', notes: null, markedByUserId: facA._id, markedAt: dayBefore },
      // Bharat: present, absent, leave → rate 1/3 = 33.3%
      { userId: facB._id, date: today, status: 'present', notes: null, markedByUserId: facB._id, markedAt: today },
      { userId: facB._id, date: yesterday, status: 'absent', notes: null, markedByUserId: facB._id, markedAt: yesterday },
      { userId: facB._id, date: dayBefore, status: 'leave', notes: null, markedByUserId: facB._id, markedAt: dayBefore },
    ]);

    return { admin, facA, facB };
  }

  it('admin sees every staff row with correct counts and rate', async () => {
    const { admin, facA, facB } = await seedRows();
    const at = await tokenFor(admin);
    const res = await http()
      .get('/v1/reports/staff-attendance')
      .query({ from: '2026-05-13', to: '2026-05-15' })
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.workingDayCount).toBe(3);
    expect(res.body.data.rows).toHaveLength(2);
    const aRow = res.body.data.rows.find((r: { userId: string }) => r.userId === String(facA._id));
    const bRow = res.body.data.rows.find((r: { userId: string }) => r.userId === String(facB._id));
    expect(aRow.presentCount).toBe(2);
    expect(aRow.lateCount).toBe(1);
    expect(aRow.attendanceRate).toBe(100); // 2 + 1 = 3 attended of 3 marked
    expect(bRow.presentCount).toBe(1);
    expect(bRow.absentCount).toBe(1);
    expect(bRow.leaveCount).toBe(1);
    expect(bRow.attendanceRate).toBeCloseTo(33.3, 0);
  });

  it('faculty role auto-scopes to self regardless of userId query', async () => {
    const { facA, facB } = await seedRows();
    const at = await tokenFor(facA);
    // Even passing facB's id, the route must overwrite with facA's id.
    const res = await http()
      .get('/v1/reports/staff-attendance')
      .query({ from: '2026-05-13', to: '2026-05-15', userId: String(facB._id) })
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].userId).toBe(String(facA._id));
  });

  it('role filter restricts the result set', async () => {
    const { admin } = await seedRows();
    const at = await tokenFor(admin);
    // Filter to faculty only — should still include both Anita + Bharat,
    // both seeded as faculty.
    const res = await http()
      .get('/v1/reports/staff-attendance')
      .query({ from: '2026-05-13', to: '2026-05-15', role: 'faculty' })
      .set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(2);
    for (const row of res.body.data.rows) {
      expect(row.role).toBe('faculty');
    }
  });

  it('xlsx format returns a spreadsheet binary', async () => {
    const { admin } = await seedRows();
    const at = await tokenFor(admin);
    const res = await http()
      .get('/v1/reports/staff-attendance')
      .query({ from: '2026-05-13', to: '2026-05-15', format: 'xlsx' })
      .set(bearer(at))
      .buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
  });

  it('student role gets 403', async () => {
    const { admin, facA: _facA } = await seedRows();
    const { user: student } = await import('../helpers/factories.js').then((m) =>
      m.makeStudent(),
    );
    const at = await tokenFor(student);
    const res = await http()
      .get('/v1/reports/staff-attendance')
      .query({ from: '2026-05-13', to: '2026-05-15' })
      .set(bearer(at));
    expect(res.status).toBe(403);
    // Use admin to keep TS happy with the unused vars
    void admin;
  });
});
