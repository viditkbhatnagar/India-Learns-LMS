import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import {
  makeCourse,
  makeProgram,
  makeUser,
} from '../helpers/factories.js';
import { routeTicket } from '../../src/services/ticketRoutingService.js';

describe('ticketRoutingService.routeTicket', () => {
  useMongo();

  it('routes academic tickets to the linked course faculty', async () => {
    const program = await makeProgram();
    const faculty = await makeUser({ role: 'faculty' });
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const result = await routeTicket({
      category: 'academic',
      linkedCourseId: course._id,
    });
    expect(result.assigneeUserId?.toString()).toBe(faculty._id.toString());
    expect(result.notifyUserIds.map((i) => i.toString())).toEqual([
      faculty._id.toString(),
    ]);
  });

  it('falls back to coordinators when no course is linked', async () => {
    const coord = await makeUser({ role: 'faculty' });
    coord.isCourseCoordinator = true;
    await coord.save();
    await makeUser({ role: 'faculty' }); // non-coordinator, should be ignored
    const result = await routeTicket({
      category: 'academic',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(coord._id.toString());
  });

  it('prefers admin deptTag=operations for administration tickets', async () => {
    await makeUser({ role: 'admin' }); // plain admin
    const ops = await makeUser({ role: 'admin' });
    ops.deptTag = 'operations';
    await ops.save();
    const result = await routeTicket({
      category: 'administration',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(ops._id.toString());
  });

  it('prefers admin deptTag=it for technical tickets', async () => {
    await makeUser({ role: 'admin' });
    const itAdmin = await makeUser({ role: 'admin' });
    itAdmin.deptTag = 'it';
    await itAdmin.save();
    const result = await routeTicket({
      category: 'technical',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(itAdmin._id.toString());
  });

  it('falls back to any admin when no deptTag match', async () => {
    const admin = await makeUser({ role: 'admin' });
    const result = await routeTicket({
      category: 'administration',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(admin._id.toString());
  });

  it('routes finance tickets to admin with deptTag=finance (M10r)', async () => {
    const fin = await makeUser({ role: 'admin', deptTag: 'finance' });
    const result = await routeTicket({
      category: 'finance',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(fin._id.toString());
  });

  it('falls back to any admin when no admin has deptTag=finance', async () => {
    const someAdmin = await makeUser({ role: 'admin' });
    const result = await routeTicket({
      category: 'finance',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId?.toString()).toBe(someAdmin._id.toString());
  });

  it('routes complaints to first superadmin and notifies the whole pool', async () => {
    const saA = await makeUser({ role: 'superadmin', email: 'sa-a@test.local' });
    const saB = await makeUser({ role: 'superadmin', email: 'sa-b@test.local' });
    const result = await routeTicket({
      category: 'complaints',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId).toBeTruthy();
    const notifyIds = result.notifyUserIds.map((i) => i.toString()).sort();
    const expected = [saA._id.toString(), saB._id.toString()].sort();
    expect(notifyIds).toEqual(expected);
  });

  it('returns null assignee when no candidates exist', async () => {
    const result = await routeTicket({
      category: 'finance',
      linkedCourseId: null,
    });
    expect(result.assigneeUserId).toBeNull();
    expect(result.notifyUserIds).toEqual([]);
  });
});
