import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface CreditNoteDoc {
  _id: Types.ObjectId;
  code: string;
  paymentId: Types.ObjectId | null;
  studentId: Types.ObjectId;
  amountPaise: number;
  balancePaise: number;
  reason: string;
  consumed: boolean;
  issuedAt: Date;
  issuedByUserId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteSchema = new Schema<CreditNoteDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: { type: Number, required: true, min: 0 },
    balancePaise: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '', maxlength: 500 },
    consumed: { type: Boolean, default: false },
    issuedAt: { type: Date, required: true },
    issuedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

CreditNoteSchema.index({ studentId: 1, consumed: 1 });

export type HydratedCreditNote = HydratedDocument<CreditNoteDoc>;

export const CreditNote =
  (mongoose.models.CreditNote as mongoose.Model<CreditNoteDoc> | undefined) ??
  model<CreditNoteDoc>('CreditNote', CreditNoteSchema);
