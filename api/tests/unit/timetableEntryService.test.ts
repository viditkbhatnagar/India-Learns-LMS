import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeBatch,
  makeCourse,
  makeFaculty,
  makeProgram,
  makeTimetableEntry,
} from '../helpers/factories.js';
import {
  assertNoOverlap,
  createEntry,
} from '../../src/services/timetableEntryService.js';

const ACTOR = (id: unknown) => ({
  role: 'admin' as const,
  actorUserId: id as never,
  ip: '127.0.0.1',
  ua: 'vitest',
});

describe('timetableEntryService.assertNoOverlap', () => {
  useMongo();
  useIntegrationSpies();

  it('detects same-batch same-day time overlap', async () => {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
      startTimeMinutes: 1080, // 18:00
      endTimeMinutes: 1200,   // 20:00
    });

    await expect(
      assertNoOverlap(
        {
          batchId: batch._id,
          facultyId: faculty._id,
          dayOfWeek: 1,
          startTimeMinutes: 1140, // 19:00
          endTimeMinutes: 1260,   // 21:00
          room: 'Room 1',
        },
      ),
    ).rejects.toMatchObject({ code: 'TIMETABLE_OVERLAP' });
  });

  it('allows back-to-back entries (end == start of next)', async () => {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });
    await makeTimetableEntry({
      batchId: batch._id,
      courseId: course._id,
      facultyId: faculty._id,
      dayOfWeek: 1,
      startTimeMinutes: 1080,
      endTimeMinutes: 1200,
    });

    await expect(
      assertNoOverlap({
        batchId: batch._id,
        facultyId: faculty._id,
        dayOfWeek: 1,
        startTimeMinutes: 1200,
        endTimeMinutes: 1320,
        room: 'Room 1',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('timetableEntryService.createEntry', () => {
  useMongo();
  useIntegrationSpies();

  it('rejects faculty who is not assigned to the course', async () => {
    const program = await makeProgram();
    const { user: assigned } = await makeFaculty();
    const { user: stranger } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [assigned._id],
    });
    const batch = await makeBatch({ programId: program._id });

    await expect(
      createEntry(
        batch._id.toString(),
        {
          courseId: course._id.toString(),
          facultyId: stranger._id.toString(),
          dayOfWeek: 1,
          startTimeMinutes: 1080,
          endTimeMinutes: 1200,
        },
        ACTOR(null),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('rejects invalid time range (end ≤ start)', async () => {
    const program = await makeProgram();
    const { user: faculty } = await makeFaculty();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const batch = await makeBatch({ programId: program._id });

    await expect(
      createEntry(
        batch._id.toString(),
        {
          courseId: course._id.toString(),
          facultyId: faculty._id.toString(),
          dayOfWeek: 1,
          startTimeMinutes: 1200,
          endTimeMinutes: 1080,
        },
        ACTOR(null),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_TIME_RANGE' });
  });
});
