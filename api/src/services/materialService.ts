import { Types } from 'mongoose';
import { HttpError } from '../middleware/error.js';
import {
  Material,
  type HydratedMaterial,
  type MaterialDoc,
  type MaterialType,
} from '../models/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertFacultyOwnsCourse } from './authzService.js';

// Phase A imports persist slide decks as Material rows with body=slide
// JSON. The session-detail endpoint already returns a thin Material
// summary (id/type/title/slideCount); this service exposes the FULL
// Material — including `body` — for the slide viewer to render against.
//
// Staff-only path. Same ownership rule as the rest of the session
// surface: faculty must be on the course; admin/superadmin bypass.

export interface MaterialDetailDto {
  id: string;
  courseId: string;
  sessionId: string | null;
  assignmentId: string | null;
  moduleId: string | null;
  type: MaterialType;
  title: string;
  body: unknown;
  url: string | null;
  sizeBytes: number | null;
  expectedHours: number | null;
  sourceDeckId: string | null;
  sourceLessonId: string | null;
  slideCount: number | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function toMaterialDetailDto(
  doc: HydratedMaterial | MaterialDoc,
): MaterialDetailDto {
  return {
    id: String(doc._id),
    courseId: doc.courseId.toString(),
    sessionId: doc.sessionId ? doc.sessionId.toString() : null,
    assignmentId: doc.assignmentId ? doc.assignmentId.toString() : null,
    moduleId: doc.moduleId ? doc.moduleId.toString() : null,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    url: doc.url,
    sizeBytes: doc.sizeBytes,
    expectedHours: doc.expectedHours,
    sourceDeckId: doc.sourceDeckId,
    sourceLessonId: doc.sourceLessonId,
    slideCount: doc.slideCount,
    uploadedAt: doc.uploadedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getMaterialForStaff(
  actor: AuthContext,
  materialId: string,
): Promise<HydratedMaterial> {
  if (!Types.ObjectId.isValid(materialId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  }
  const material = await Material.findOne({ _id: materialId, deletedAt: null });
  if (!material) throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  await assertFacultyOwnsCourse(actor.userId, actor.role, material.courseId);
  return material;
}
