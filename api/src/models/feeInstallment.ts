import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  FeeReminderTemplate,
  InstallmentStatus,
} from 'india-learns-shared-types';

export interface ReminderSentEntry {
  template: FeeReminderTemplate;
  at: Date;
}

export interface FeeInstallmentDoc {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId;
  studentId: Types.ObjectId;
  label: string;
  amountPaise: number;
  paidPaise: number;
  dueDate: Date;
  // M10x — Free-text milestone label that displays instead of the
  // calendar date when set. Matches Logan's Excel rows like
  // "Registration Fee | Seat Reservation" or "Admission Fee | Upon
  // Admission" — events, not specific dates. We still keep `dueDate`
  // (a placeholder Date that admin can set to roughly when they
  // expect the milestone) so the existing reminder cron + sorting
  // keep working.
  dueLabel: string | null;
  status: InstallmentStatus;
  remindersSent: ReminderSentEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSentSchema = new Schema<ReminderSentEntry>(
  {
    template: {
      type: String,
      enum: [
        'fees.upcoming.14d',
        'fees.upcoming.7d',
        'fees.due.today',
        'fees.overdue.3d',
        'fees.warning.1',
        'fees.warning.2',
        'fees.suspended',
      ],
      required: true,
    },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const FeeInstallmentSchema = new Schema<FeeInstallmentDoc>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: { type: String, required: true, maxlength: 160 },
    amountPaise: { type: Number, required: true, min: 0 },
    paidPaise: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    // M10x — Milestone label (e.g., "Seat Reservation", "Upon Admission").
    dueLabel: { type: String, default: null, maxlength: 120, trim: true },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'waived'],
      default: 'pending',
    },
    remindersSent: { type: [ReminderSentSchema], default: [] },
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

// TRD §4.13 — drives the hourly reminder cron.
FeeInstallmentSchema.index({ dueDate: 1, status: 1 });
FeeInstallmentSchema.index({ studentId: 1, status: 1, dueDate: 1 });

export type HydratedFeeInstallment = HydratedDocument<FeeInstallmentDoc>;

export const FeeInstallment =
  (mongoose.models.FeeInstallment as mongoose.Model<FeeInstallmentDoc> | undefined) ??
  model<FeeInstallmentDoc>('FeeInstallment', FeeInstallmentSchema);
