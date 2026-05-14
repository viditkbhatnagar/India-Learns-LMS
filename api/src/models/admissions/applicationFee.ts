import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { PaymentMethod } from 'india-learns-shared-types';

// M6 — Application fee tracking.
//
// One ApplicationFee per Application, auto-created at submit time using
// `program.applicationFeePaise`. Status starts at `pending` and transitions to
// `paid` (via ApplicationPayment) or `waived` (by officer / finance). The
// officer admit gate (M5+M6) refuses to decide `admit` unless fee.status ∈
// {paid, waived}.
//
// Distinct from the existing Invoice / FeeInstallment / Payment trio because
// those are tied to enrollment + multi-installment tuition; application fees
// are a single one-off charge with no enrollment yet.

export const APPLICATION_FEE_STATUSES = ['pending', 'paid', 'waived'] as const;
export type ApplicationFeeStatus = (typeof APPLICATION_FEE_STATUSES)[number];

export interface ApplicationFeeDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  programId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  amountPaise: number;
  status: ApplicationFeeStatus;
  paidAt: Date | null;
  paymentId: Types.ObjectId | null;
  waivedAt: Date | null;
  waivedBy: Types.ObjectId | null;
  waivedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationFeeSchema = new Schema<ApplicationFeeDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      unique: true,
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: APPLICATION_FEE_STATUSES,
      default: 'pending',
      index: true,
    },
    paidAt: { type: Date, default: null },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'ApplicationPayment',
      default: null,
    },
    waivedAt: { type: Date, default: null },
    waivedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    waivedReason: { type: String, default: null },
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

export type HydratedApplicationFee = HydratedDocument<ApplicationFeeDoc>;

export const ApplicationFee =
  (mongoose.models.ApplicationFee as
    | mongoose.Model<ApplicationFeeDoc>
    | undefined) ??
  model<ApplicationFeeDoc>('ApplicationFee', ApplicationFeeSchema);

// ============================================================================
// ApplicationPayment — finance staff records when the fee comes in.
// ============================================================================

export interface ApplicationPaymentDoc {
  _id: Types.ObjectId;
  applicationFeeId: Types.ObjectId;
  applicantUserId: Types.ObjectId;
  amountPaise: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: Date;
  recordedByUserId: Types.ObjectId;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationPaymentSchema = new Schema<ApplicationPaymentDoc>(
  {
    applicationFeeId: {
      type: Schema.Types.ObjectId,
      ref: 'ApplicationFee',
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
      required: true,
    },
    reference: { type: String, default: '' },
    receivedAt: { type: Date, default: () => new Date() },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: { type: String, default: '' },
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

export type HydratedApplicationPayment = HydratedDocument<ApplicationPaymentDoc>;

export const ApplicationPayment =
  (mongoose.models.ApplicationPayment as
    | mongoose.Model<ApplicationPaymentDoc>
    | undefined) ??
  model<ApplicationPaymentDoc>('ApplicationPayment', ApplicationPaymentSchema);
