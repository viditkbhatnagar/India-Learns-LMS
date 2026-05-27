import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeProgram } from '../helpers/factories.js';
import { Course, ModuleModel } from '../../src/models/index.js';
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
