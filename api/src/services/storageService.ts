import { Types } from 'mongoose';
import type {
  Role,
  StorageFolder,
  StorageUploadTicketResponse,
} from 'india-learns-shared-types';
import { loadEnv } from '../config/env.js';
import { HttpError } from '../middleware/error.js';
import { getIntegrations } from '../integrations/index.js';
import { Course } from '../models/index.js';
import { facultyAssignedToCourse } from './courseService.js';

const FACULTY_ALLOWED_FOLDERS = new Set<StorageFolder>(['course-pdfs', 'course-videos']);

export async function requestUploadTicket(
  input: {
    folder: StorageFolder;
    filename: string;
    contentType: string;
    courseId?: string;
  },
  actor: { role: Role; userId: Types.ObjectId },
): Promise<StorageUploadTicketResponse> {
  if (actor.role !== 'admin' && actor.role !== 'faculty') {
    throw new HttpError(403, 'FORBIDDEN', 'Only admins or faculty may request upload URLs.');
  }
  if (actor.role === 'faculty') {
    if (!FACULTY_ALLOWED_FOLDERS.has(input.folder)) {
      throw new HttpError(
        403,
        'FORBIDDEN',
        'Faculty may only upload to course-pdfs or course-videos.',
      );
    }
    if (!input.courseId || !Types.ObjectId.isValid(input.courseId)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        'courseId is required when faculty requests an upload URL.',
      );
    }
    const course = await Course.findOne({ _id: input.courseId, deletedAt: null });
    if (!course) throw new HttpError(404, 'NOT_FOUND', 'Course not found.');
    if (!facultyAssignedToCourse(course, actor.userId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Not assigned to this course.');
    }
  }
  const env = loadEnv();
  const { storage } = getIntegrations();
  const ticket = await storage.signedUploadTicket({
    folder: input.folder,
    filename: input.filename,
    contentType: input.contentType,
  });
  const provider: StorageUploadTicketResponse['provider'] =
    env.INTEGRATIONS_MODE === 'stub' || env.STORAGE_PROVIDER === 'stub'
      ? 'stub'
      : 'cloudinary';
  return {
    url: ticket.url,
    key: ticket.key,
    headers: ticket.headers,
    expiresAt: ticket.expiresAt,
    provider,
  };
}
