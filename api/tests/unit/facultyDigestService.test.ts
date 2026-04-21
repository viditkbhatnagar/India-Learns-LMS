import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeCourse,
  makeExam,
  makeExamAttempt,
  makeFeedback,
  makeProgram,
  makeUser,
} from '../helpers/factories.js';
import {
  buildFacultyDigestBuckets,
  runFacultyDigest,
} from '../../src/services/facultyDigestService.js';

const EIGHT_DAYS_MS = 8 * 86_400_000;
const ONE_DAY_MS = 86_400_000;

describe('facultyDigestService', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('includes ungraded essay attempts submitted >7 days ago, excludes recent ones', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'Essay', kind: 'essay', points: 10 }],
    });
    const now = new Date();
    // Old (should include) — essay not graded (totalScorePercent null).
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(now.getTime() - EIGHT_DAYS_MS),
      essayAnswers: [{ questionIndex: 0, text: 'ans' }],
    });
    // Recent (should exclude).
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(now.getTime() - ONE_DAY_MS),
      essayAnswers: [{ questionIndex: 0, text: 'ans' }],
    });

    const buckets = await buildFacultyDigestBuckets(now);
    expect(buckets.length).toBe(1);
    expect(buckets[0]!.facultyId).toBe(faculty._id.toString());
    expect(buckets[0]!.items.length).toBe(1);
    expect(buckets[0]!.items[0]!.kind).toBe('ungraded_essay');
  });

  it('groups items per faculty when multiple faculty own different courses', async () => {
    const facultyA = await makeUser({ role: 'faculty' });
    const facultyB = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const courseA = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [facultyA._id],
    });
    const courseB = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [facultyB._id],
    });
    const examA = await makeExam({
      courseId: courseA._id,
      questions: [{ text: 'Essay', kind: 'essay', points: 10 }],
    });
    const examB = await makeExam({
      courseId: courseB._id,
      questions: [{ text: 'Essay', kind: 'essay', points: 10 }],
    });
    const now = new Date();
    await makeExamAttempt({
      examId: examA._id,
      studentId: student._id,
      submittedAt: new Date(now.getTime() - EIGHT_DAYS_MS),
      essayAnswers: [{ questionIndex: 0, text: 'a' }],
    });
    await makeExamAttempt({
      examId: examB._id,
      studentId: student._id,
      submittedAt: new Date(now.getTime() - EIGHT_DAYS_MS),
      essayAnswers: [{ questionIndex: 0, text: 'b' }],
    });

    const buckets = await buildFacultyDigestBuckets(now);
    const byFaculty = new Map(buckets.map((b) => [b.facultyId, b]));
    expect(byFaculty.get(facultyA._id.toString())!.items.length).toBe(1);
    expect(byFaculty.get(facultyB._id.toString())!.items.length).toBe(1);
  });

  it('includes stale draft feedback older than 7 days', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const now = new Date();
    await makeFeedback({
      studentId: student._id,
      courseId: course._id,
      facultyId: faculty._id,
      level: 'module',
      moduleId: null, // artifact of test
      status: 'draft',
      createdAt: new Date(now.getTime() - EIGHT_DAYS_MS),
    });
    const buckets = await buildFacultyDigestBuckets(now);
    expect(buckets.length).toBe(1);
    expect(buckets[0]!.items[0]!.kind).toBe('pending_feedback');
  });

  it('runFacultyDigest sends one email per faculty via the spy adapter', async () => {
    const faculty = await makeUser({ role: 'faculty' });
    const student = await makeUser({ role: 'student' });
    const program = await makeProgram();
    const course = await makeCourse({
      programId: program._id,
      state: 'published',
      facultyIds: [faculty._id],
    });
    const exam = await makeExam({
      courseId: course._id,
      questions: [{ text: 'Essay', kind: 'essay', points: 10 }],
    });
    const now = new Date();
    await makeExamAttempt({
      examId: exam._id,
      studentId: student._id,
      submittedAt: new Date(now.getTime() - EIGHT_DAYS_MS),
      essayAnswers: [{ questionIndex: 0, text: 'ans' }],
    });

    const result = await runFacultyDigest(now);
    expect(result.facultyCount).toBe(1);
    expect(result.emailsSent).toBe(1);
    expect(spies.email.calls[0]!.to).toBe(faculty.email);
    expect(spies.email.calls[0]!.tag).toBe('faculty.weekly_digest');
  });
});
