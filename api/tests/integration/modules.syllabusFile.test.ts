import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import {
  makeAdmin,
  makeCourse,
  makeModule,
  makeProgram,
} from '../helpers/factories.js';
import { FileMeta } from '../../src/models/index.js';

// Helper: seed a FileMeta row the way StorageAdapter.upload() would.
async function seedFileMeta(overrides?: {
  filename?: string;
  contentType?: string;
  size?: number;
}): Promise<{ id: string; doc: Awaited<ReturnType<typeof FileMeta.create>> }> {
  const id = new Types.ObjectId();
  const doc = await FileMeta.create({
    _id: id,
    folder: 'course-pdfs',
    s3Bucket: 'test-bucket',
    s3Key: `course-pdfs/${id.toHexString()}`,
    filename: overrides?.filename ?? 'syllabus.docx',
    contentType:
      overrides?.contentType ??
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: overrides?.size ?? 12_345,
    uploadedByUserId: null,
    migratedFromGridfs: false,
  });
  return { id: id.toHexString(), doc };
}

describe('PATCH /v1/modules/:id — syllabusFile', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('admin attaches a syllabus file → DTO carries it', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    const file = await seedFileMeta();

    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: file.id } });

    expect(res.status).toBe(200);
    expect(res.body.data.module.syllabusFile).toMatchObject({
      fileId: file.id,
      filename: 'syllabus.docx',
      size: 12_345,
    });
  });

  it('replacing an attached file deletes the previous FileMeta+S3 via the adapter', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const first = await seedFileMeta({ filename: 'old.docx' });
    await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: first.id } });
    spies.storage.deletes.length = 0; // reset before the action under test

    const second = await seedFileMeta({ filename: 'new.docx' });
    const replaced = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: second.id } });

    expect(replaced.status).toBe(200);
    expect(replaced.body.data.module.syllabusFile.fileId).toBe(second.id);
    expect(replaced.body.data.module.syllabusFile.filename).toBe('new.docx');
    expect(spies.storage.deletes).toEqual([first.id]);
  });

  it('clearing the file (syllabusFile: null) deletes via adapter and nulls the DTO', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    const file = await seedFileMeta();
    await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: file.id } });
    spies.storage.deletes.length = 0;

    const cleared = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.module.syllabusFile).toBeNull();
    expect(spies.storage.deletes).toEqual([file.id]);
  });

  it('attaching a non-existent fileId returns 404', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const ghostId = new Types.ObjectId().toHexString();
    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: ghostId } });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('attaching an invalid fileId returns 422', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });

    const res = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: 'not-a-valid-objectid' } });

    expect(res.status).toBe(422);
  });

  it('re-attaching the same fileId is a no-op (no spy.delete called)', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const mod = await makeModule({ courseId: course._id, order: 0 });
    const file = await seedFileMeta();
    await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: file.id } });
    spies.storage.deletes.length = 0;

    const again = await http()
      .patch(`/v1/modules/${mod._id.toString()}`)
      .set(bearer(at))
      .send({ syllabusFile: { fileId: file.id } });

    expect(again.status).toBe(200);
    expect(spies.storage.deletes).toEqual([]);
  });
});
