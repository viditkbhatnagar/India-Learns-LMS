import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// One AttendanceRecord per (sessionId, studentId) — idempotent upsert.
// The faculty UI defaults each row to `present` when the panel opens; the
// stored value is whatever the faculty submits. `late` is a distinct
// status, NOT a derived field.
//
// Phase B-2 records but does not enforce attendance — no course-completion
// math hangs off it yet (per OPEN-QUESTIONS.md, default is no enforcement).

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecordDoc {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  courseId: Types.ObjectId;        // denormalized for faster course-scoped queries
  studentId: Types.ObjectId;
  status: AttendanceStatus;
  markedBy: Types.ObjectId;
  markedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<AttendanceRecordDoc>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    markedAt: { type: Date, default: () => new Date() },
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

// One record per (session, student). Bulk upsert keys on this index.
AttendanceRecordSchema.index(
  { sessionId: 1, studentId: 1 },
  { unique: true },
);

export type HydratedAttendanceRecord = HydratedDocument<AttendanceRecordDoc>;

export const AttendanceRecord =
  (mongoose.models.AttendanceRecord as mongoose.Model<AttendanceRecordDoc> | undefined) ??
  model<AttendanceRecordDoc>('AttendanceRecord', AttendanceRecordSchema);
