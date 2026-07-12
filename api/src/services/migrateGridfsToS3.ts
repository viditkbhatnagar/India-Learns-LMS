import type { Readable } from 'node:stream';
import mongoose from 'mongoose';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { STORAGE_FOLDERS, type StorageFolder } from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { FileMeta } from '../models/fileMeta.js';

// Use mongoose's bundled mongodb driver — the top-level `mongodb` package is
// bson-skewed by the test-only mongodb-memory-server (see mongoStorageAdapter).
const { GridFSBucket } = mongoose.mongo;
type GridFsBucketInstance = InstanceType<typeof mongoose.mongo.GridFSBucket>;
type ObjectIdInstance = InstanceType<typeof mongoose.mongo.ObjectId>;

// One-shot migration: each GridFS file in `il_files` is streamed to S3
// at key `<folder>/<id>`, a matching FileMeta row is written with the
// same ObjectId so the public `/v1/files/:id` URL keeps resolving, then
// the GridFS document is deleted (unless `keepGridfs` is true).

const BUCKET_NAME = 'il_files';
const VALID_FOLDERS = new Set<StorageFolder>(
  STORAGE_FOLDERS as readonly StorageFolder[],
);

export interface MigrationOptions {
  s3Bucket: string;
  s3Region: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsEndpoint?: string;
  dryRun?: boolean;
  /** If true, keep GridFS originals after successful S3 upload. */
  keepGridfs?: boolean;
}

export interface MigrationSummary {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
}

interface GridfsDoc {
  _id: ObjectIdInstance;
  filename?: string;
  contentType?: string | null;
  length: number;
  metadata?: { folder?: string; mimeType?: string } | null;
  uploadDate?: Date;
}

function inferFolder(doc: GridfsDoc): StorageFolder {
  const f = doc.metadata?.folder;
  if (f && VALID_FOLDERS.has(f as StorageFolder)) {
    return f as StorageFolder;
  }
  return 'ticket-attachments';
}

function gridfsBucket(): GridFsBucketInstance {
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) {
    throw new Error('Mongoose connection not ready.');
  }
  return new GridFSBucket(conn.db, { bucketName: BUCKET_NAME });
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function runGridfsToS3Migration(
  opts: MigrationOptions,
): Promise<MigrationSummary> {
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) {
    throw new Error(
      'runGridfsToS3Migration: caller must connect mongoose first.',
    );
  }

  const s3 = new S3Client({
    region: opts.s3Region,
    ...(opts.awsEndpoint
      ? { endpoint: opts.awsEndpoint, forcePathStyle: true }
      : {}),
    credentials: {
      accessKeyId: opts.awsAccessKeyId,
      secretAccessKey: opts.awsSecretAccessKey,
    },
  });

  const filesColl = conn.db.collection<GridfsDoc>(`${BUCKET_NAME}.files`);
  const total = await filesColl.countDocuments();
  logger.info(
    { total, dryRun: !!opts.dryRun, keepGridfs: !!opts.keepGridfs },
    'migration.start',
  );
  if (total === 0) return { total: 0, migrated: 0, skipped: 0, failed: 0 };

  const bucket = gridfsBucket();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const cursor = filesColl.find({});
  for await (const doc of cursor) {
    const id = doc._id;
    const idHex = id.toHexString();
    const folder = inferFolder(doc);
    const s3Key = `${folder}/${idHex}`;
    const contentType =
      doc.contentType ?? doc.metadata?.mimeType ?? 'application/octet-stream';
    const filename = doc.filename ?? `${idHex}.bin`;

    try {
      const existing = await FileMeta.findById(id);
      if (existing) {
        logger.info({ id: idHex, s3Key }, 'migration.skip.already_migrated');
        skipped += 1;
        continue;
      }
      if (opts.dryRun) {
        logger.info(
          { id: idHex, s3Key, folder, contentType, size: doc.length },
          'migration.dry_run.would_migrate',
        );
        migrated += 1;
        continue;
      }

      const buf = await streamToBuffer(bucket.openDownloadStream(id));

      await s3.send(
        new PutObjectCommand({
          Bucket: opts.s3Bucket,
          Key: s3Key,
          Body: buf,
          ContentType: contentType,
          ContentDisposition: `inline; filename="${encodeURIComponent(filename)}"`,
          ServerSideEncryption: 'AES256',
          Metadata: {
            folder,
            'original-filename': filename,
            'migrated-from': 'gridfs',
            'migrated-at': new Date().toISOString(),
          },
        }),
      );

      // Verify the upload landed before touching GridFS.
      await s3.send(
        new HeadObjectCommand({ Bucket: opts.s3Bucket, Key: s3Key }),
      );

      await FileMeta.create({
        _id: id,
        folder,
        s3Bucket: opts.s3Bucket,
        s3Key,
        filename,
        contentType,
        size: buf.byteLength,
        uploadedByUserId: null,
        migratedFromGridfs: true,
      });

      if (!opts.keepGridfs) {
        await bucket.delete(id);
      }

      logger.info(
        { id: idHex, s3Key, bytes: buf.byteLength, keptGridfs: !!opts.keepGridfs },
        'migration.migrated',
      );
      migrated += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        { id: idHex, s3Key, err: (err as Error).message },
        'migration.failed',
      );
    }
  }

  const summary = { total, migrated, skipped, failed };
  logger.info({ ...summary, dryRun: !!opts.dryRun }, 'migration.complete');
  return summary;
}
