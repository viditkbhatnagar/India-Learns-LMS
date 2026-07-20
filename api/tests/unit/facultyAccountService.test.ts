import { describe, expect, it } from 'vitest';
import type { Types } from 'mongoose';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { makeAdmin, makeCourse, makeProgram, makeStudent } from '../helpers/factories.js';
import { FacultyCredential, User } from '../../src/models/index.js';
import { verifyPassword } from '../../src/services/passwordService.js';
import {
  createFacultyAccount,
  listFacultyAccounts,
  resetFacultyPassword,
} from '../../src/services/facultyAccountService.js';

function adminActor(id: Types.ObjectId) {
  return { role: 'admin' as const, actorUserId: id, ip: '', ua: '' };
}

describe('facultyAccountService', () => {
  useMongo();

  it('creates an active faculty with a working, encrypted-stored password', async () => {
    const { user: admin } = await makeAdmin();
    const { user, temporaryPassword } = await createFacultyAccount(
      { name: 'Priya', email: 'Priya@X.com', phoneE164: '+919812345678' },
      adminActor(admin._id),
    );
    expect(user.role).toBe('faculty');
    expect(user.status).toBe('active');
    expect(user.email).toBe('priya@x.com'); // normalized
    expect(user.code).toMatch(/^IL-\d{4}-\d{4}$/);
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(12);

    // Password verifies against the stored hash → the faculty can log in.
    const fresh = await User.findById(user._id);
    expect(await verifyPassword(fresh!.passwordHash, temporaryPassword)).toBe(true);

    // Credential stored, and NOT as plaintext.
    const cred = await FacultyCredential.findOne({ userId: user._id });
    expect(cred).not.toBeNull();
    expect(cred!.secret).not.toContain(temporaryPassword);
  });

  it('lists faculty with the decrypted password + course-assignment count', async () => {
    const { user: admin } = await makeAdmin();
    const { user, temporaryPassword } = await createFacultyAccount(
      { name: 'A', email: 'a@x.com', phoneE164: '+919812345601' },
      adminActor(admin._id),
    );
    const program = await makeProgram();
    await makeCourse({ programId: program._id, facultyIds: [user._id] });

    const list = await listFacultyAccounts(adminActor(admin._id));
    const row = list.find((f) => f.id === String(user._id));
    expect(row).toBeDefined();
    expect(row!.password).toBe(temporaryPassword);
    expect(row!.coursesCount).toBe(1);
  });

  it('reset generates a new working password and invalidates the old one', async () => {
    const { user: admin } = await makeAdmin();
    const { user, temporaryPassword } = await createFacultyAccount(
      { name: 'B', email: 'b@x.com', phoneE164: '+919812345602' },
      adminActor(admin._id),
    );
    const { temporaryPassword: next } = await resetFacultyPassword(String(user._id), adminActor(admin._id));
    expect(next).not.toBe(temporaryPassword);

    const fresh = await User.findById(user._id);
    expect(await verifyPassword(fresh!.passwordHash, next)).toBe(true);
    expect(await verifyPassword(fresh!.passwordHash, temporaryPassword)).toBe(false);
  });

  it('rejects duplicate email and non-admin actors', async () => {
    const { user: admin } = await makeAdmin();
    await createFacultyAccount(
      { name: 'C', email: 'c@x.com', phoneE164: '+919812345603' },
      adminActor(admin._id),
    );
    await expect(
      createFacultyAccount(
        { name: 'C2', email: 'c@x.com', phoneE164: '+919812345604' },
        adminActor(admin._id),
      ),
    ).rejects.toThrow(/already exists/i);

    const { user: stu } = await makeStudent();
    await expect(
      createFacultyAccount(
        { name: 'D', email: 'd@x.com', phoneE164: '+919812345605' },
        { role: 'student', actorUserId: stu._id, ip: '', ua: '' },
      ),
    ).rejects.toThrow(/only admins/i);
  });
});
