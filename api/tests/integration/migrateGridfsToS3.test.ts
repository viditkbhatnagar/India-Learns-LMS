import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runGridfsToS3Migration } from '../../src/services/migrateGridfsToS3.js';
import { FileMeta } from '../../src/models/fileMeta.js';

// Use mongoose's bundled bson types — mixing with a separately-installed
// `mongodb` package's BSON triggers "Unsupported BSON version" errors.
const { ObjectId, Binary } = mongoose.mongo;

// Live end-to-end migration test. Gated by AWS_S3_INTEGRATION=1.
// Seeds an in-memory Mongo with one GridFS file, runs the migration
// against the real S3 bucket, then asserts S3 + FileMeta + GridFS state.

const LIVE = process.env.AWS_S3_INTEGRATION === '1';
const describeLive = LIVE ? describe : describe.skip;

describeLive('runGridfsToS3Migration (live)', () => {
  let server: MongoMemoryServer;
  const seededIds: ObjectId[] = [];

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
  }, 30_000);

  afterAll(async () => {
    // Best-effort S3 cleanup of any test objects.
    const s3 = new S3Client({
      region: 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    for (const id of seededIds) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: `ticket-attachments/${id.toHexString()}`,
          }),
        );
      } catch {
        // ignore — best effort
      }
    }
    await mongoose.disconnect();
    await server.stop();
  });

  it('migrates one file → S3 has the object, FileMeta row exists, GridFS empty', async () => {
    const conn = mongoose.connection;
    if (!conn.db) throw new Error('no db');

    // Seed GridFS-formatted documents directly. The migration only reads
    // files via `bucket.openDownloadStream(id)`, which works as long as
    // `il_files.files` has the metadata doc and `il_files.chunks` has the
    // bytes. (We bypass the GridFSBucket *write* stream because its
    // `finish` event hangs under mongodb-memory-server on Node 24.)
    const fileId = new ObjectId();
    seededIds.push(fileId);
    const payload = Buffer.from(
      `gridfs→s3 migration test ${new Date().toISOString()}`,
    );
    await conn.db.collection('il_files.files').insertOne({
      _id: fileId,
      length: payload.byteLength,
      chunkSize: 261120,
      uploadDate: new Date(),
      filename: 'mig-test.txt',
      contentType: 'text/plain; charset=utf-8',
      metadata: { folder: 'ticket-attachments', mimeType: 'text/plain' },
    });
    await conn.db.collection('il_files.chunks').insertOne({
      _id: new ObjectId(),
      files_id: fileId,
      n: 0,
      data: new Binary(payload),
    });

    // Run the migration directly (no subprocess — faster + better errors).
    const summary = await runGridfsToS3Migration({
      s3Bucket: process.env.AWS_S3_BUCKET!,
      s3Region: 'ap-south-1',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    });

    expect(summary).toEqual({ total: 1, migrated: 1, skipped: 0, failed: 0 });

    // FileMeta row with same _id.
    const meta = await FileMeta.findById(fileId);
    expect(meta).toBeTruthy();
    expect(meta!.s3Bucket).toBe(process.env.AWS_S3_BUCKET);
    expect(meta!.s3Key).toBe(`ticket-attachments/${fileId.toHexString()}`);
    expect(meta!.size).toBe(payload.byteLength);
    expect(meta!.migratedFromGridfs).toBe(true);

    // GridFS is empty.
    const gridfsCount = await conn.db
      .collection('il_files.files')
      .countDocuments();
    expect(gridfsCount).toBe(0);

    // S3 object exists with right contentType + size.
    const s3 = new S3Client({
      region: 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `ticket-attachments/${fileId.toHexString()}`,
      }),
    );
    expect(head.ContentLength).toBe(payload.byteLength);
    expect(head.ContentType).toBe('text/plain; charset=utf-8');
  }, 30_000);

  it('second run is idempotent: already-migrated files are skipped', async () => {
    const summary = await runGridfsToS3Migration({
      s3Bucket: process.env.AWS_S3_BUCKET!,
      s3Region: 'ap-south-1',
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    });
    // GridFS is empty after the first test, so total=0.
    expect(summary).toEqual({ total: 0, migrated: 0, skipped: 0, failed: 0 });
  });
});
