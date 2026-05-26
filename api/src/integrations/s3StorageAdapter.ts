import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Types } from 'mongoose';
import type {
  StorageAdapter,
  StorageFolder,
  StorageSignedUploadTicket,
  StorageUploadInput,
  StorageUploadResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';
import { FileMeta } from '../models/fileMeta.js';

// S3 storage adapter. Bytes live in AWS S3; per-file metadata
// (filename, contentType, size, folder) lives in the FileMeta Mongo
// collection, keyed by the same ObjectId that appears in the public
// `/v1/files/:id` URL.
//
// S3 key layout: `<folder>/<24-char-objectid-hex>`
//   - `folder` is the StorageFolder enum (course-pdfs, receipts, etc.)
//     so the bucket browses cleanly in the S3 console.
//   - The id is the FileMeta._id so the public URL stays stable across
//     migration from GridFS — we reuse the original GridFS ObjectId as
//     the FileMeta _id when migrating.
//
// The `url` returned by upload() is always the proxy URL
// `${API_ORIGIN}/v1/files/<id>` — same contract as GridFS. The
// /v1/files/:id route handles auth and either streams from S3 or
// 302-redirects to a short-lived presigned GET URL.

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const env = loadEnv();
  if (!env.AWS_S3_BUCKET) {
    throw new Error(
      'S3StorageAdapter not wired — set AWS_S3_BUCKET in the environment.',
    );
  }
  cachedClient = new S3Client({
    region: env.AWS_REGION,
    ...(env.AWS_S3_ENDPOINT
      ? { endpoint: env.AWS_S3_ENDPOINT, forcePathStyle: true }
      : {}),
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });
  return cachedClient;
}

function urlForId(id: Types.ObjectId | string): string {
  const env = loadEnv();
  const hex = typeof id === 'string' ? id : id.toHexString();
  return `${env.API_ORIGIN.replace(/\/$/, '')}/v1/files/${hex}`;
}

function s3KeyFor(folder: StorageFolder, id: Types.ObjectId): string {
  return `${folder}/${id.toHexString()}`;
}

export class S3StorageAdapter implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!input.bytes) {
      throw new Error('S3StorageAdapter.upload requires input.bytes.');
    }
    const env = loadEnv();
    const id = new Types.ObjectId();
    const key = s3KeyFor(input.folder, id);
    const body = Buffer.from(input.bytes);
    await client().send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: input.contentType,
        ContentDisposition: `inline; filename="${encodeURIComponent(input.filename)}"`,
        ServerSideEncryption: 'AES256',
        Metadata: {
          folder: input.folder,
          'original-filename': input.filename,
        },
      }),
    );
    await FileMeta.create({
      _id: id,
      folder: input.folder,
      s3Bucket: env.AWS_S3_BUCKET,
      s3Key: key,
      filename: input.filename,
      contentType: input.contentType,
      size: body.byteLength,
      uploadedByUserId: null,
      migratedFromGridfs: false,
    });
    logger.info(
      {
        folder: input.folder,
        filename: input.filename,
        contentType: input.contentType,
        bytes: body.byteLength,
        key: id.toHexString(),
        s3Key: key,
      },
      'storage.s3.upload',
    );
    return { url: urlForId(id), key: id.toHexString() };
  }

  async delete(key: string): Promise<void> {
    if (!Types.ObjectId.isValid(key)) return;
    const meta = await FileMeta.findById(key);
    if (!meta) return;
    try {
      await client().send(
        new DeleteObjectCommand({ Bucket: meta.s3Bucket, Key: meta.s3Key }),
      );
    } catch (err) {
      logger.warn({ key, err }, 'storage.s3.delete_failed');
    }
    await FileMeta.deleteOne({ _id: meta._id });
    logger.info({ key, s3Key: meta.s3Key }, 'storage.s3.delete');
  }

  async signedUrl(key: string, ttlSec?: number): Promise<string> {
    const env = loadEnv();
    if (!Types.ObjectId.isValid(key)) return urlForId(key);
    const meta = await FileMeta.findById(key);
    if (!meta) return urlForId(key);
    const expiresIn = ttlSec ?? env.AWS_S3_SIGNED_URL_TTL_SEC;
    return getSignedUrl(
      client(),
      new GetObjectCommand({ Bucket: meta.s3Bucket, Key: meta.s3Key }),
      { expiresIn },
    );
  }

  async signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    // Same pattern as the Mongo adapter: the ticket points at our own
    // multipart endpoint (`/v1/files/upload`). The browser POSTs the file
    // there with cookie auth, the API then calls S3StorageAdapter.upload.
    // This avoids any S3 CORS configuration and keeps the auth model
    // exactly the same as the rest of the SPA. If we ever want direct
    // browser-to-S3 uploads we can switch this to a presigned POST.
    const env = loadEnv();
    const ttl = input.ttlSec ?? env.AWS_S3_SIGNED_URL_TTL_SEC;
    const provisionalKey = new Types.ObjectId().toHexString();
    return {
      url: `${env.API_ORIGIN.replace(/\/$/, '')}/v1/files/upload?folder=${encodeURIComponent(
        input.folder,
      )}`,
      key: provisionalKey,
      headers: { 'content-type': 'multipart/form-data' },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }
}

// Helpers used by the /v1/files/:id route.

export interface S3FileHandle {
  filename: string;
  contentType: string;
  length: number;
  stream: Readable;
}

export async function fetchS3File(id: string): Promise<S3FileHandle | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const meta = await FileMeta.findById(id);
  if (!meta || meta.deletedAt) return null;
  const res = await client().send(
    new GetObjectCommand({ Bucket: meta.s3Bucket, Key: meta.s3Key }),
  );
  if (!res.Body) return null;
  return {
    filename: meta.filename,
    contentType: meta.contentType,
    length: meta.size,
    stream: res.Body as Readable,
  };
}

/** Test-only: drop the cached S3 client (e.g., after env mutation). */
export function resetS3ClientCache(): void {
  cachedClient = null;
}
