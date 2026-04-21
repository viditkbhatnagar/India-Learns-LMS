import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { FeeComponentKind, InvoiceStatus } from 'india-learns-shared-types';

export interface InvoiceDoc {
  _id: Types.ObjectId;
  code: string;
  enrollmentId: Types.ObjectId;
  studentId: Types.ObjectId;
  feeStructureId: Types.ObjectId;
  componentKind: FeeComponentKind;
  componentLabel: string;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<InvoiceDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Enrollment',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    feeStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: true,
    },
    componentKind: {
      type: String,
      enum: ['registration', 'tuition', 'exam', 'certification', 'misc'],
      required: true,
    },
    componentLabel: { type: String, required: true, maxlength: 160 },
    totalPaise: { type: Number, required: true, min: 0 },
    paidPaise: { type: Number, default: 0, min: 0 },
    balancePaise: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['open', 'settled', 'waived', 'cancelled'],
      default: 'open',
      index: true,
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

// Idempotency: at most one invoice per (enrollment, component) — used by
// invoiceGenerationService.generateForEnrollment to make retries safe.
InvoiceSchema.index(
  { enrollmentId: 1, componentKind: 1, componentLabel: 1 },
  { unique: true },
);
InvoiceSchema.index({ studentId: 1, status: 1 });

export type HydratedInvoice = HydratedDocument<InvoiceDoc>;

export const Invoice =
  (mongoose.models.Invoice as mongoose.Model<InvoiceDoc> | undefined) ??
  model<InvoiceDoc>('Invoice', InvoiceSchema);
