import type { StorageFolder } from '../enums.js';

export interface StorageUploadTicketRequest {
  folder: StorageFolder;
  filename: string;
  contentType: string;
  courseId?: string;
}

export interface StorageUploadTicketResponse {
  url: string;
  key: string;
  headers?: Record<string, string>;
  expiresAt: string;
  provider: 'stub' | 'cloudinary' | 'mongo' | 's3';
}
