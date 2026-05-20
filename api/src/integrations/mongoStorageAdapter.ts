import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId, type Db } from 'mongodb';
import { nanoid } from 'nanoid';
import type {
  StorageAdapter,
  StorageFolder,
  StorageSignedUploadTicket,
  StorageUploadInput,
  StorageUploadResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';

// M10q — MongoDB GridFS storage adapter (LMS_Requirements §1 + §2 file
// uploads, without depending on Cloudinary).
//
// Storage layout:
// - One GridFSBucket called `il_files` on the same Atlas DB the rest of
//   the app uses (mongoose default connection).
// - GridFS auto-chunks files into 255 KB pieces under
//   `il_files.chunks` + metadata in `il_files.files`.
// - We tag every file with `metadata: { folder, ownerUserId?, mimeType }`
//   so cleanup + audits can scope by folder.
// - Adapter `key` is the GridFS file _id (24-char hex). `url` is
//   `${API_ORIGIN}/v1/files/<id>` — same-origin in production, so the
//   browser fetches with auth cookies and the GET handler streams the
//   file back after a permission check.
//
// Trade-off vs. Cloudinary: no CDN, files served straight from Mongo.
// For LUC's scale (~30 students/class × ~10 docs each × ~500 KB) this is
// well under any Atlas tier's storage budget. Swap to Cloudinary later
// by flipping STORAGE_PROVIDER=cloudinary — URL contract is identical
// (consumers only see `key` + `url`, never how the adapter stored it).

const BUCKET_NAME = 'il_files';

let cachedBucket: GridFSBucket | null = null;
function bucket(): GridFSBucket {
  if (cachedBucket) return cachedBucket;
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) {
    throw new Error(
      'MongoStorageAdapter: mongoose connection not ready. ' +
        'Make sure connectDb() ran before any storage call.',
    );
  }
  cachedBucket = new GridFSBucket(conn.db as unknown as Db, {
    bucketName: BUCKET_NAME,
  });
  return cachedBucket;
}

function urlFor(id: ObjectId): string {
  const env = loadEnv();
  // Always emit absolute URLs so external sinks (email links, exports)
  // don't break. Same-origin in prod; localhost in dev.
  return `${env.API_ORIGIN.replace(/\/$/, '')}/v1/files/${id.toHexString()}`;
}

export class MongoStorageAdapter implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!input.bytes) {
      throw new Error('MongoStorageAdapter.upload requires input.bytes.');
    }
    const b = bucket();
    const filename = input.filename || `${nanoid(16)}.bin`;
    const id = new ObjectId();
    await new Promise<void>((resolve, reject) => {
      const stream = b.openUploadStreamWithId(id, filename, {
        contentType: input.contentType,
        metadata: {
          folder: input.folder,
          mimeType: input.contentType,
          createdAt: new Date(),
        },
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      Readable.from(Buffer.from(input.bytes!)).pipe(stream);
    });
    logger.info(
      {
        folder: input.folder,
        filename,
        contentType: input.contentType,
        bytes: input.bytes.byteLength,
        key: id.toHexString(),
      },
      'storage.mongo.upload',
    );
    return { url: urlFor(id), key: id.toHexString() };
  }

  async delete(key: string): Promise<void> {
    if (!ObjectId.isValid(key)) return;
    try {
      await bucket().delete(new ObjectId(key));
      logger.info({ key }, 'storage.mongo.delete');
    } catch (err) {
      // FileNotFound is fine — idempotent delete.
      logger.warn({ key, err }, 'storage.mongo.delete_failed');
    }
  }

  async signedUrl(key: string, _ttlSec?: number): Promise<string> {
    // Mongo-served files don't need a signed URL — the GET /v1/files/:id
    // route handles auth via the session cookie. We return the canonical
    // URL for consistency with the other adapters. `_ttlSec` is accepted
    // to match the interface but ignored.
    if (!ObjectId.isValid(key)) return urlFor(new ObjectId());
    return urlFor(new ObjectId(key));
  }

  async signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    // For the Mongo adapter, the "ticket" is just our own upload
    // endpoint. The browser POSTs multipart to it; we apply the auth
    // middleware on the route, so no separate token plumbing is needed.
    const env = loadEnv();
    const ttl = input.ttlSec ?? 300;
    const provisionalKey = new ObjectId().toHexString();
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

// Helpers used by the GET /v1/files/:id route.

export async function fetchGridfsFile(
  id: string,
): Promise<{
  filename: string;
  contentType: string | null;
  length: number;
  stream: Readable;
} | null> {
  if (!ObjectId.isValid(id)) return null;
  const conn = mongoose.connection;
  if (!conn.db) return null;
  const files = conn.db.collection(`${BUCKET_NAME}.files`);
  // Mongoose ships its own bundled `bson` whose `ObjectId` is structurally
  // distinct from `mongodb/bson`'s, even though both wrap the same 12-byte
  // value at runtime. Cast the filter through `unknown` to sidestep the
  // duelling type hierarchies.
  const oid = new ObjectId(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await files.findOne({ _id: oid } as any);
  if (!doc) return null;
  return {
    filename: (doc.filename as string) ?? 'file',
    contentType:
      (doc.contentType as string | undefined) ??
      (doc.metadata as { mimeType?: string } | null)?.mimeType ??
      null,
    length: (doc.length as number) ?? 0,
    stream: bucket().openDownloadStream(oid),
  };
}
