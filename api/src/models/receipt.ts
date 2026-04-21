import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface ReceiptDoc {
  _id: Types.ObjectId;
  code: string;
  paymentId: Types.ObjectId;
  studentId: Types.ObjectId;
  pdfUrl: string;
  pdfKey: string;
  issuedAt: Date;
  issuedByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptSchema = new Schema<ReceiptDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pdfUrl: { type: String, required: true, maxlength: 2000 },
    pdfKey: { type: String, required: true, maxlength: 500 },
    issuedAt: { type: Date, required: true },
    issuedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

export type HydratedReceipt = HydratedDocument<ReceiptDoc>;

export const Receipt =
  (mongoose.models.Receipt as mongoose.Model<ReceiptDoc> | undefined) ??
  model<ReceiptDoc>('Receipt', ReceiptSchema);
