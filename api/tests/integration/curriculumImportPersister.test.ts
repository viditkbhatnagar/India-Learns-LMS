import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeProgram } from '../helpers/factories.js';
import { Course, ModuleModel, SessionModel } from '../../src/models/index.js';
import { persistImport } from '../../src/services/curriculumImport/persister.js';
import type { TransformedImport } from '../../src/services/curriculumImport/transformer.js';

// Minimal TransformedImport fixture — one course + one module is enough
// to exercise the create/replace/revive branches in the persister.
function fixture(overrides?: {
  workflowId?: string;
  slug?: string;
  name?: string;
  moduleTitle?: string;
}): TransformedImport {
  return {
    course: {
      name: overrides?.name ?? 'Diploma in Airline and Airport Management',
      slug: overrides?.slug ?? 'airline-and-airport-management',
      summary: 'Aviation programme.',
      sourceWorkflowId: overrides?.workflowId ?? 'wf-airline-001',
      sourceWorkflowVersion: 'v1',
      programLearningOutcomes: [],
      glossary: [{ term: 'Apron', definition: 'Aircraft parking area.' }],
      readingList: [{ title: 'Airport Ops 101', author: 'J. Doe', url: '', note: 'Core' }],
    },
    modules: [
      {
        key: 'mod-1',
        sourceModuleId: 'mod-1',
        code: 'M1',
        title: overrides?.moduleTitle ?? 'Intro to Airline Ops',
        order: 1,
        aim: 'Intro',
        prerequisites: [],
        coreElective: 'core',
        totalHours: 10,
        contactHours: 8,
        selfStudyHours: 2,
        learningOutcomes: [],
        glossary: [{ term: 'PNR', definition: 'Passenger Name Record.' }],
        readingList: [{ title: 'Module Reading', author: '', url: 'https://x.test/m', note: '' }],
      },
    ],
    sessions: [],
    materials: [],
    assignments: [],
    warnings: [],
  };
}

describe('curriculum import — revive after soft-delete', () => {
  useMongo();
  useIntegrationSpies();

  it('re-import after deleteCourse() succeeds: same _id, deletedAt cleared, content refreshed', async () => {
    const program = await makeProgram();
    const actor = { actorUserId: new Types.ObjectId(), ip: '127.0.0.1', ua: 'vitest' };

    // 1. First import → fresh course.
    const first = await persistImport(fixture(), {
      programId: program._id,
      replace: false,
      actor,
    });
    expect(first.created.course).toBe(true);
    const courseId = first.courseId;
    const beforeRevive = await Course.findById(courseId);
    expect(beforeRevive?.deletedAt).toBeNull();
    expect(beforeRevive?.name).toBe('Diploma in Airline and Airport Management');
    // Glossary + reading list auto-imported onto the course (Logan request).
    expect(beforeRevive?.glossary?.[0]?.term).toBe('Apron');
    expect(beforeRevive?.readingList?.[0]?.title).toBe('Airport Ops 101');
    // And onto the module.
    const importedModule = await ModuleModel.findOne({ courseId, sourceModuleId: 'mod-1' });
    expect(importedModule?.glossary?.[0]?.term).toBe('PNR');
    expect(importedModule?.readingList?.[0]?.url).toBe('https://x.test/m');

    // 2. Operator soft-deletes the course (simulating what they did in the UI).
    await Course.updateOne(
      { _id: courseId },
      { $set: { deletedAt: new Date('2026-05-26T10:00:00Z') } },
    );

    // 3. Re-import the same workflow with updated content + NO replace flag —
    //    this is the exact path the user hit when the bug fired.
    const second = await persistImport(
      fixture({ name: 'Diploma in Airline and Airport Management (v2)', moduleTitle: 'Updated module' }),
      { programId: program._id, replace: false, actor },
    );

    // 4. Same _id, deletedAt cleared, content updated, warning surfaced.
    expect(second.courseId.equals(courseId)).toBe(true);
    expect(second.created.course).toBe(false); // revival is not a create
    expect(second.warnings.some((w) => /Reviving previously deleted course/.test(w))).toBe(true);

    const revived = await Course.findById(courseId);
    expect(revived?.deletedAt).toBeNull();
    expect(revived?.state).toBe('sandbox');
    expect(revived?.name).toBe('Diploma in Airline and Airport Management (v2)');

    // 5. Imported children are refreshed (old module wiped, new one in place).
    const modules = await ModuleModel.find({ courseId }).sort({ order: 1 });
    expect(modules.length).toBe(1);
    expect(modules[0]!.title).toBe('Updated module');
  });

  it('re-import without prior delete still requires replace=true (no behavioral change)', async () => {
    const program = await makeProgram();
    const actor = { actorUserId: new Types.ObjectId(), ip: '127.0.0.1', ua: 'vitest' };

    await persistImport(fixture(), { programId: program._id, replace: false, actor });

    // Second import without replace=true and without a soft-delete → no-op + warning.
    const second = await persistImport(
      fixture({ name: 'Should not be applied' }),
      { programId: program._id, replace: false, actor },
    );
    expect(second.created.course).toBe(false);
    expect(second.warnings.some((w) => /pass replace=true/.test(w))).toBe(true);

    // Course name unchanged because replace=true wasn't passed.
    const after = await Course.findById(second.courseId);
    expect(after?.name).toBe('Diploma in Airline and Airport Management');
  });
});

describe('curriculum import — adopt an existing (document-sourced) course', () => {
  useMongo();
  useIntegrationSpies();

  it('rebuilds a detached course in place: same _id, faculty kept, old lessons archived', async () => {
    const program = await makeProgram();
    const actor = { actorUserId: new Types.ObjectId(), ip: '127.0.0.1', ua: 'vitest' };

    // A course built from an uploaded document: no sourceWorkflowId, and its
    // lessons carry no source ids (so a normal import would NOT clear them).
    const facultyId = new Types.ObjectId();
    const docCourse = await Course.create({
      programId: program._id,
      name: 'Doc-sourced course',
      slug: 'doc-sourced-course',
      state: 'sandbox',
      facultyIds: [facultyId],
      sourceWorkflowId: null,
      lastSyncedAt: new Date(),
    });
    const docModule = await ModuleModel.create({
      courseId: docCourse._id, title: 'From the Word file', order: 0, content: [],
    });
    await SessionModel.create({
      moduleId: docModule._id, courseId: docCourse._id, number: 1,
      title: 'Doc lesson', sourceLessonId: null, synthesized: false,
    });

    const res = await persistImport(fixture(), {
      programId: program._id,
      replace: false, // adoption alone must force the rebuild
      actor,
      adoptCourseId: String(docCourse._id),
    });

    expect(String(res.courseId)).toBe(String(docCourse._id)); // same course
    expect(res.created.course).toBe(false);

    const after = await Course.findById(docCourse._id);
    expect(after!.sourceWorkflowId).toBe(fixture().course.sourceWorkflowId); // now tracked
    expect(after!.facultyIds.map(String)).toEqual([String(facultyId)]); // roster kept

    // the document lessons are archived, not sitting alongside the new ones
    const liveSessions = await SessionModel.find({ courseId: docCourse._id, deletedAt: null });
    expect(liveSessions.every((s) => s.sourceLessonId !== null || s.synthesized)).toBe(true);
    const archived = await SessionModel.countDocuments({
      courseId: docCourse._id, deletedAt: { $ne: null },
    });
    expect(archived).toBe(1);
  });

  it('refuses to adopt a course from a different program', async () => {
    const programA = await makeProgram();
    const programB = await makeProgram();
    const actor = { actorUserId: new Types.ObjectId(), ip: '127.0.0.1', ua: 'vitest' };
    const other = await Course.create({
      programId: programB._id, name: 'Elsewhere', slug: 'elsewhere', state: 'sandbox',
    });
    await expect(
      persistImport(fixture(), {
        programId: programA._id, replace: true, actor, adoptCourseId: String(other._id),
      }),
    ).rejects.toThrow(/different program/i);
  });
});
