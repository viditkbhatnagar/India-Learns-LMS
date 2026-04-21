import { nanoid } from 'nanoid';
import { v2 as cloudinary, type UploadApiOptions } from 'cloudinary';
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
  // Per-process cache of upload bytes so tests (and the stub-mode receipt
  // download path) can fetch the PDF back by key without a real provider.
  private static bytesByKey = new Map<string, Uint8Array>();

  static getCached(key: string): Uint8Array | null {
    return ConsoleStorageAdapter.bytesByKey.get(key) ?? null;
  }

  /** Test-only: let spy adapters push their bytes into the stub cache. */
  static setCached(key: string, bytes: Uint8Array): void {
    ConsoleStorageAdapter.bytesByKey.set(key, bytes);
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const id = nanoid(16);
    const ext = extFromFilename(input.filename);
    const key = `stub:${input.folder}:${id}`;
    const url = `https://stub.local/${input.folder}/${id}.${ext}`;
    if (input.bytes) {
      ConsoleStorageAdapter.bytesByKey.set(key, input.bytes);
    }
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
    ConsoleStorageAdapter.bytesByKey.delete(key);
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
  private configured = false;

  private configure(): void {
    if (this.configured) return;
    const env = loadEnv();
    if (
      !env.CLOUDINARY_CLOUD_NAME ||
      !env.CLOUDINARY_API_KEY ||
      !env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        'CloudinaryStorageAdapter not wired — missing CLOUDINARY_* env vars.',
      );
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    this.configured = true;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    this.configure();
    if (!input.bytes) {
      throw new Error('CloudinaryStorageAdapter.upload requires input.bytes.');
    }
    const options: UploadApiOptions = {
      folder: `il/${input.folder}`,
      resource_type: 'auto',
      public_id: input.filename.replace(/\.[^.]+$/, ''),
      type: 'authenticated',
      overwrite: false,
    };
    return new Promise<StorageUploadResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary upload returned no result.'));
          return;
        }
        resolve({
          url: result.secure_url,
          key: result.public_id,
        });
      });
      stream.end(Buffer.from(input.bytes!));
    });
  }

  async delete(key: string): Promise<void> {
    this.configure();
    await cloudinary.uploader.destroy(key, { type: 'authenticated' });
  }

  async signedUrl(key: string, ttlSec: number = DEFAULT_UPLOAD_TTL_SEC): Promise<string> {
    this.configure();
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
    return cloudinary.utils.private_download_url(key, 'pdf', {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: expiresAt,
    });
  }

  async signedUploadTicket(input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    ttlSec?: number;
  }): Promise<StorageSignedUploadTicket> {
    this.configure();
    const env = loadEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = input.filename.replace(/\.[^.]+$/, '');
    const folder = `il/${input.folder}`;
    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        public_id: publicId,
        timestamp,
        type: 'authenticated',
      },
      env.CLOUDINARY_API_SECRET,
    );
    const url = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`;
    const key = `${folder}/${publicId}`;
    const ttl = input.ttlSec ?? DEFAULT_UPLOAD_TTL_SEC;
    return {
      url,
      key,
      headers: {
        'x-cld-signature': signature,
        'x-cld-api-key': env.CLOUDINARY_API_KEY,
        'x-cld-timestamp': String(timestamp),
      },
      expiresAt: new Date((timestamp + ttl) * 1000).toISOString(),
    };
  }
}
