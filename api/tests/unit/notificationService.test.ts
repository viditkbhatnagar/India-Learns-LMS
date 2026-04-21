import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeFaculty,
  makeProgram,
  makeStudent,
  makeTimetableEntry,
} from '../helpers/factories.js';
import {
  enqueueNotification,
  notifyTimetableChange,
  typeToChannels,
} from '../../src/services/notificationService.js';
import { Notification } from '../../src/models/index.js';

describe('notificationService', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('typeToChannels excludes WhatsApp for timetable.change', () => {
    const channels = typeToChannels('timetable.change');
    expect(channels).toEqual(['inapp', 'email']);
    expect(channels.includes('email')).toBe(true);
    // Confirm WhatsApp is not wired.
    // @ts-expect-error — WhatsApp channel isn't in the NotificationChannel type.
    expect(channels.includes('whatsapp')).toBe(false);
  });

  it('enqueueNotification persists Notification per recipient and dispatches email', async () => {
    const { user: student1 } = await makeStudent();
    const { user: student2 } = await makeStudent();
    const docs = await enqueueNotification({
      type: 'timetable.change',
      recipients: [student1._id, student2._id],
      title: 'Schedule update',
      body: 'Tomorrow\'s class moved to 19:00 IST.',
      data: { overrideId: 'x' },
    });
    expect(docs).toHaveLength(2);
    expect(spies.email.calls).toHaveLength(2);
    expect(spies.whatsapp.calls).toHaveLength(0);
    const stored = await Notification.find({});
    expect(stored).toHaveLength(2);
    expect(stored.every((d) => d.emailSentAt !== null)).toBe(true);
  });

  it('enqueueNotification gracefully records email failures without throwing', async () => {
    const { user: student } = await makeStudent();
    const originalSend = spies.email.send.bind(spies.email);
    spies.email.send = async () => {
      throw new Error('Resend 429 — rate limited');
    };
    try {
      const docs = await enqueueNotification({
        type: 'timetable.change',
        recipients: [student._id],
        title: 'X',
        body: 'Y',
      });
      expect(docs).toHaveLength(1);
      const stored = await Notification.findById(docs[0]!._id);
      expect(stored?.emailSentAt).toBeNull();
      expect(stored?.emailError).toContain('Resend 429');
    } finally {
      spies.email.send = originalSend;
    }
  });

  it('notifyTimetableChange fans out to all active students + both faculties', async () => {
    const program = await makeProgram();
    const { user: faculty1 } = await makeFaculty();
    const { user: faculty2 } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty1._id, faculty2._id],
    });
    const batch = await makeBatch({ programId: program._id });
    const { user: s1 } = await makeStudent();
    const { user: s2 } = await makeStudent();
    await makeEnrollment({
      studentId: s1._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    await makeEnrollment({
      studentId: s2._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });

    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty1._id,
      dayOfWeek: 1,
    });

    await notifyTimetableChange({
      batchId: batch._id,
      action: 'reschedule',
      overrideId: batch._id, // arbitrary
      date: new Date(),
      istDate: '2026-07-08',
      entryId: null,
      newFacultyId: faculty2._id,
      originalFacultyId: faculty1._id,
      batchName: batch.name,
      courseName: course.name,
      reason: 'Faculty swap',
    });

    const docs = await Notification.find({});
    // s1 + s2 + faculty1 + faculty2 = 4
    expect(docs.length).toBe(4);
    const recipients = new Set(docs.map((d) => d.userId.toString()));
    expect(recipients.has(s1._id.toString())).toBe(true);
    expect(recipients.has(s2._id.toString())).toBe(true);
    expect(recipients.has(faculty1._id.toString())).toBe(true);
    expect(recipients.has(faculty2._id.toString())).toBe(true);
    expect(spies.whatsapp.calls).toHaveLength(0);
  });
});
