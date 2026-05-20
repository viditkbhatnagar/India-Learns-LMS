import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendanceStatus,
} from 'india-learns-shared-types';

// M10u — Staff attendance. One row per staff per date (unique partial
// index, soft-delete-aware). Faculty self-marks; admin can override or
// mark on behalf. `date` is stored as a UTC midnight Date so equality
// comparisons across day boundaries are stable.

export interface StaffAttendanceDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date;
  status: StaffAttendanceStatus;
  notes: string | null;
  markedByUserId: Types.ObjectId;
  markedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaffAttendanceSchema = new Schema<StaffAttendanceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: STAFF_ATTENDANCE_STATUSES,
      required: true,
    },
    notes: { type: String, default: null, maxlength: 2000 },
    markedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    markedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true, versionKey: false },
);

StaffAttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
StaffAttendanceSchema.index({ date: -1 });

export type HydratedStaffAttendance = HydratedDocument<StaffAttendanceDoc>;
export const StaffAttendance = model<StaffAttendanceDoc>(
  'StaffAttendance',
  StaffAttendanceSchema,
);
