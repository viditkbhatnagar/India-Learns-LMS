import { Types } from 'mongoose';
import { HttpError } from '../middleware/error.js';
import {
  Material,
  SessionModel,
  type HydratedMaterial,
  type MaterialDoc,
  type MaterialType,
} from '../models/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertFacultyCanWriteCourse, assertFacultyOwnsCourse } from './authzService.js';
import { recordAudit } from './auditService.js';

// Faculty-add material types — slides are uploaded via the slide-upload
// path (separate, body-heavy flow); the rest are URL-based.
const ADD_MATERIAL_TYPES = new Set<MaterialType>([
  'reading', 'pdf', 'video', 'link', 'practice', 'reflection', 'file', 'case',
]);

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

interface ActorCtx {
  ip?: string;
  ua?: string;
}

export interface CreateMaterialInput {
  type: MaterialType;
  title: string;
  url?: string | null;
  body?: string | null;
  sizeBytes?: number | null;
  expectedHours?: number | null;
}

/**
 * PR #16 Phase 2 — faculty can attach a non-slides material to a session.
 * URL-backed for now (operator pastes a Google Drive / Cloudinary / etc.
 * link). Slide decks have their own upload path because the body is
 * structured JSON, not a URL.
 */
export async function createMaterialOnSession(
  actor: AuthContext,
  sessionIdStr: string,
  input: CreateMaterialInput,
  ctx: ActorCtx = {},
): Promise<HydratedMaterial> {
  if (!Types.ObjectId.isValid(sessionIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
  }
  const session = await SessionModel.findOne({ _id: sessionIdStr, deletedAt: null })
    .select('_id courseId moduleId');
  if (!session) throw new HttpError(404, 'NOT_FOUND', 'Session not found.');
  await assertFacultyCanWriteCourse(actor.userId, actor.role, session.courseId);

  if (!ADD_MATERIAL_TYPES.has(input.type)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Material type ${input.type} cannot be added directly. Use the slide-upload flow for slides.`,
    );
  }
  if (!input.title || !input.title.trim()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Material title is required.');
  }
  if (input.url) {
    try {
      // Surface a clean 422 instead of letting Mongoose error out later.
      // Same parser the schema's maxlength check protects against.
      // eslint-disable-next-line no-new
      new URL(input.url);
    } catch {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Material URL is not a valid URL.');
    }
  }

  const material = await Material.create({
    courseId: session.courseId,
    sessionId: session._id,
    moduleId: null,
    assignmentId: null,
    type: input.type,
    title: input.title.trim(),
    body: input.body ?? null,
    url: input.url?.trim() ? input.url.trim() : null,
    sizeBytes: input.sizeBytes ?? null,
    expectedHours: input.expectedHours ?? null,
    sourceDeckId: null,
    sourceLessonId: null,
    slideCount: null,
    uploadedBy: actor.userId,
    uploadedAt: new Date(),
  });

  await recordAudit({
    actorUserId: actor.userId,
    action: 'material.created',
    targetType: 'Material',
    targetId: material._id,
    before: null,
    after: material.toObject(),
    details: {
      sessionId: session._id.toString(),
      courseId: session.courseId.toString(),
      type: input.type,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return material;
}

/**
 * A renderable slide is a plain object carrying a `content` object — the
 * shape the curriculum generator emits and the MaterialViewer renders
 * (it keys off `slide.content.type`). We validate this BEFORE persisting
 * so a non-slides file can't corrupt the deck: e.g. a PowerPoint
 * converted to JSON, an arbitrary array, or an array of strings. Without
 * this guard the bad shape was stored verbatim and the viewer crashed
 * with "Cannot read properties of undefined (reading 'title')" — and the
 * deck could no longer be opened at all. Errors name the offending slide
 * and point faculty at the correct affordance.
 */
function assertRenderableSlides(slides: readonly unknown[]): void {
  const guidance =
    'This file does not look like a slides export — use "Download deck" to get the correct JSON format. To share a PowerPoint or PDF with students, use "Upload PowerPoint / PDF" instead.';
  slides.forEach((slide, i) => {
    const n = i + 1;
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Slide ${n} is not a valid slide object. ${guidance}`,
      );
    }
    const { content } = slide as { content?: unknown };
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new HttpError(
        422,
        'VALIDATION_FAILED',
        `Slide ${n} has no valid "content" object (expected a plain object). ${guidance}`,
      );
    }
  });
}

/**
 * Replace the slide payload of a `type=slides` material. Faculty paste
 * a JSON array (or `{ slides: [...] }` object) of slide objects in the
 * generator's shape; the route persists it as `Material.body` and bumps
 * `slideCount`. Used by the "Replace slides" affordance in the
 * MaterialViewer (Logan asked for it after seeing faculty want to
 * customise the generator-imported decks).
 */
export async function replaceSlideBody(
  actor: AuthContext,
  materialId: string,
  body: unknown,
  ctx: ActorCtx = {},
): Promise<HydratedMaterial> {
  if (!Types.ObjectId.isValid(materialId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  }
  const material = await Material.findOne({ _id: materialId, deletedAt: null });
  if (!material) throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  if (material.type !== 'slides') {
    throw new HttpError(
      409,
      'WRONG_MATERIAL_TYPE',
      'Only slide-deck materials can have their body replaced via this endpoint.',
    );
  }
  await assertFacultyCanWriteCourse(actor.userId, actor.role, material.courseId);

  // Accept both shapes the generator emits — bare array or { slides }.
  let slides: unknown[];
  if (Array.isArray(body)) {
    slides = body;
  } else if (body && typeof body === 'object' && Array.isArray((body as { slides?: unknown[] }).slides)) {
    slides = (body as { slides: unknown[] }).slides;
  } else {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Slide body must be either an array or an object with a `slides` array.',
    );
  }
  if (slides.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'A slide deck must contain at least one slide.');
  }
  assertRenderableSlides(slides);

  const before = material.toObject();
  material.set('body', slides);
  // `body` is a Mixed field — flag it dirty so the new array always persists.
  material.markModified('body');
  material.slideCount = slides.length;
  material.uploadedBy = actor.userId;
  material.uploadedAt = new Date();
  await material.save();

  await recordAudit({
    actorUserId: actor.userId,
    action: 'material.slides.replaced',
    targetType: 'Material',
    targetId: material._id,
    before,
    after: material.toObject(),
    details: {
      sessionId: material.sessionId?.toString() ?? null,
      courseId: material.courseId.toString(),
      slideCount: slides.length,
    },
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return material;
}

export async function deleteMaterial(
  actor: AuthContext,
  materialId: string,
  ctx: ActorCtx = {},
): Promise<HydratedMaterial> {
  if (!Types.ObjectId.isValid(materialId)) {
    throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  }
  const material = await Material.findOne({ _id: materialId, deletedAt: null });
  if (!material) throw new HttpError(404, 'NOT_FOUND', 'Material not found.');
  await assertFacultyCanWriteCourse(actor.userId, actor.role, material.courseId);

  const before = material.toObject();
  material.deletedAt = new Date();
  await material.save();
  await recordAudit({
    actorUserId: actor.userId,
    action: 'material.deleted',
    targetType: 'Material',
    targetId: material._id,
    before,
    after: material.toObject(),
    ip: ctx.ip,
    ua: ctx.ua,
  });
  return material;
}
