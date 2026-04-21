import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { PaymentMethod } from 'india-learns-shared-types';

export interface PaymentAllocation {
  installmentId: Types.ObjectId;
  amountPaise: number;
}

export interface PaymentDoc {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  receivedAt: Date;
  amountPaise: number;
  method: PaymentMethod;
  reference: string;
  allocations: PaymentAllocation[];
  receivedByUserId: Types.ObjectId;
  notes: string;
  reversed: boolean;
  reversedAt: Date | null;
  reversedByUserId: Types.ObjectId | null;
  creditNoteId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<PaymentAllocation>(
  {
    installmentId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeInstallment',
      required: true,
    },
    amountPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PaymentSchema = new Schema<PaymentDoc>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receivedAt: { type: Date, required: true, index: true },
    amountPaise: { type: Number, required: true, min: 1 },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
      required: true,
    },
    reference: { type: String, default: '', maxlength: 200 },
    allocations: { type: [PaymentAllocationSchema], default: [] },
    receivedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: { type: String, default: '', maxlength: 1000 },
    reversed: { type: Boolean, default: false, index: true },
    reversedAt: { type: Date, default: null },
    reversedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creditNoteId: {
      type: Schema.Types.ObjectId,
      ref: 'CreditNote',
      default: null,
    },
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

PaymentSchema.index({ studentId: 1, receivedAt: -1 });

export type HydratedPayment = HydratedDocument<PaymentDoc>;

export const Payment =
  (mongoose.models.Payment as mongoose.Model<PaymentDoc> | undefined) ??
  model<PaymentDoc>('Payment', PaymentSchema);
