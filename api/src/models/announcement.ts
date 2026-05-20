import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

// M10j — extends original course-only announcements with broader scope:
//   - course (legacy default): targets a single course, courseId set
//   - batch: targets a single batch, batchId set
//   - program: targets all students in a programme, programId set
//   - global: targets every active user (admin only)
//
// Existing course-announcements created pre-M10j default to scope='course'
// when the field is missing — schema default + a backfill query handles it.
export const ANNOUNCEMENT_SCOPES = ['course', 'batch', 'program', 'global'] as const;
export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

export interface AnnouncementDoc {
  _id: Types.ObjectId;
  // M10j — all three FK fields are nullable; the active one matches `scope`.
  courseId: Types.ObjectId | null;
  batchId: Types.ObjectId | null;
  programId: Types.ObjectId | null;
  scope: AnnouncementScope;
  authorUserId: Types.ObjectId;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const AnnouncementSchema = new Schema<AnnouncementDoc>(
  {
    // courseId stays required at the schema level for legacy course
    // announcements; M10j writes use the broader factory in
    // announcementService which sets it conditionally.
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', default: null, index: true },
    programId: { type: Schema.Types.ObjectId, ref: 'Program', default: null, index: true },
    scope: {
      type: String,
      enum: ANNOUNCEMENT_SCOPES,
      default: 'course',
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: { type: String, required: true, maxlength: 240 },
    body: { type: String, required: true, maxlength: 4000 },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

// Course feed is read chronological-desc; index supports it cheaply.
AnnouncementSchema.index({ courseId: 1, createdAt: -1 });

export type HydratedAnnouncement = HydratedDocument<AnnouncementDoc>;

export const Announcement =
  (mongoose.models.Announcement as mongoose.Model<AnnouncementDoc> | undefined) ??
  mongoose.model<AnnouncementDoc>('Announcement', AnnouncementSchema);
