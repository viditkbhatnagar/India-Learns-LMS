import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// Materials are things students consume (slides, readings, files, links).
// Exactly one of sessionId / assignmentId / moduleId is set — schema-level
// validation enforces this.

export type MaterialType =
  | 'slides'
  | 'reading'
  | 'pdf'
  | 'video'
  | 'link'
  | 'practice'
  | 'reflection'
  | 'file'
  | 'case';

export interface MaterialDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;          // denormalized for query speed
  sessionId: Types.ObjectId | null;
  assignmentId: Types.ObjectId | null;
  moduleId: Types.ObjectId | null;
  type: MaterialType;
  title: string;
  // Structured content (e.g. slide JSON for type='slides'). Stored as Mixed
  // because the shape is per-type. Renderers in the UI key off `type`.
  body: unknown;
  url: string | null;
  sizeBytes: number | null;
  expectedHours: number | null;
  // Provenance from generator import.
  sourceDeckId: string | null;
  sourceLessonId: string | null;
  slideCount: number | null;
  uploadedBy: Types.ObjectId | null;
  uploadedAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema = new Schema<MaterialDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true,
    },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'Module',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['slides', 'reading', 'pdf', 'video', 'link', 'practice', 'reflection', 'file', 'case'],
      required: true,
    },
    title: { type: String, required: true, maxlength: 400 },
    body: { type: Schema.Types.Mixed, default: null },
    url: { type: String, default: null, maxlength: 2048 },
    sizeBytes: { type: Number, default: null },
    expectedHours: { type: Number, default: null },
    sourceDeckId: { type: String, default: null },
    sourceLessonId: { type: String, default: null },
    slideCount: { type: Number, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedAt: { type: Date, default: () => new Date() },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

MaterialSchema.pre('validate', function attachmentScopeCheck(next) {
  const scopes = [this.sessionId, this.assignmentId, this.moduleId].filter(Boolean);
  if (scopes.length !== 1) {
    return next(
      new Error('Material must reference exactly one of sessionId, assignmentId, or moduleId.'),
    );
  }
  return next();
});

// Idempotency for re-import: a generator deck shouldn't double-up on a course.
MaterialSchema.index(
  { courseId: 1, sourceDeckId: 1 },
  { unique: true, partialFilterExpression: { sourceDeckId: { $type: 'string' } } },
);

export type HydratedMaterial = HydratedDocument<MaterialDoc>;

export const Material =
  (mongoose.models.Material as mongoose.Model<MaterialDoc> | undefined) ??
  model<MaterialDoc>('Material', MaterialSchema);
