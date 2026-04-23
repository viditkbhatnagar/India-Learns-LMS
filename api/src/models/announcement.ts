import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export interface AnnouncementDoc {
  _id: Types.ObjectId;
  courseId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const AnnouncementSchema = new Schema<AnnouncementDoc>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
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
