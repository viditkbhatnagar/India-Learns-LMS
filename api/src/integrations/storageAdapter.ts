import { nanoid } from 'nanoid';
import type {
  StorageAdapter,
  StorageFolder,
  StorageSignedUploadTicket,
  StorageUploadInput,
  StorageUploadResult,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

const DEFAULT_UPLOAD_TTL_SEC = 300;

function extFromFilename(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx < 0 || idx === filename.length - 1) return 'bin';
  return filename.slice(idx + 1).toLowerCase();
}

export class ConsoleStorageAdapter implements StorageAdapter {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const id = nanoid(16);
    const ext = extFromFilename(input.filename);
    const key = `stub:${input.folder}:${id}`;
    const url = `https://stub.local/${input.folder}/${id}.${ext}`;
    logger.info(
      {
        folder: input.folder,
        filename: input.filename,
        contentType: input.contentType,
        bytes: input.bytes ? input.bytes.byteLength : 0,
        key,
        url,
      },
      'storage.upload',
    );
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    logger.info({ key }, 'storage.delete');
  }

  async signedUrl(key: string, ttlSec: number = DEFAULT_UPLOAD_TTL_SEC): Promise<string> {
    const parts = key.split(':');
    const folder = (parts[1] ?? 'misc') as StorageFolder | 'misc';
    const id = parts[2] ?? key.replace(/[^a-z0-9-]/gi, '');
    return `https://stub.local/${folder}/${id}.bin?sig=stub&ttl=${ttlSec}`;
  }

  async signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    const id = nanoid(16);
    const ext = extFromFilename(input.filename);
    const key = `stub:${input.folder}:${id}`;
    const url = `https://stub.local/${input.folder}/${id}.${ext}?sig=stub`;
    const ttl = input.ttlSec ?? DEFAULT_UPLOAD_TTL_SEC;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return {
      url,
      key,
      headers: { 'content-type': input.contentType },
      expiresAt,
    };
  }
}

export class CloudinaryStorageAdapter implements StorageAdapter {
  private assertConfigured(): void {
    const env = loadEnv();
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        'CloudinaryStorageAdapter not wired — missing CLOUDINARY_* env vars. Scheduled for M5 receipts.',
      );
    }
  }

  async upload(_input: StorageUploadInput): Promise<StorageUploadResult> {
    this.assertConfigured();
    throw new Error('CloudinaryStorageAdapter.upload not yet implemented.');
  }

  async delete(_key: string): Promise<void> {
    this.assertConfigured();
    throw new Error('CloudinaryStorageAdapter.delete not yet implemented.');
  }

  async signedUrl(_key: string, _ttlSec?: number): Promise<string> {
    this.assertConfigured();
    throw new Error('CloudinaryStorageAdapter.signedUrl not yet implemented.');
  }

  async signedUploadTicket(_input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    this.assertConfigured();
    throw new Error('CloudinaryStorageAdapter.signedUploadTicket not yet implemented.');
  }
}
