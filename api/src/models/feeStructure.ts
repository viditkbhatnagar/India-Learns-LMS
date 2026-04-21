import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  FeeComponentCadence,
  FeeComponentKind,
  FeeDueRule,
} from 'india-learns-shared-types';

export interface FeeComponentDoc {
  kind: FeeComponentKind;
  label: string;
  amountPaise: number;
  cadence: FeeComponentCadence;
  monthlyCount: number | null;
  dueRule: FeeDueRule;
  weights: number[] | null;
}

export interface FeeStructureDoc {
  _id: Types.ObjectId;
  programId: Types.ObjectId;
  name: string;
  components: FeeComponentDoc[];
  paymentTerms: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FeeComponentSchema = new Schema<FeeComponentDoc>(
  {
    kind: {
      type: String,
      enum: ['registration', 'tuition', 'exam', 'certification', 'misc'],
      required: true,
    },
    label: { type: String, required: true, maxlength: 120 },
    amountPaise: { type: Number, required: true, min: 0 },
    cadence: {
      type: String,
      enum: ['one_time', 'monthly_x'],
      required: true,
    },
    monthlyCount: { type: Number, default: null, min: 1 },
    dueRule: {
      type: String,
      enum: [
        'on_enrolment',
        'first_of_month',
        'exam_scheduled',
        'month_before_end',
        'manual',
      ],
      required: true,
    },
    weights: { type: [Number], default: null },
  },
  { _id: false },
);

const FeeStructureSchema = new Schema<FeeStructureDoc>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 160 },
    components: { type: [FeeComponentSchema], default: [] },
    paymentTerms: { type: String, default: '', maxlength: 2000 },
    deletedAt: { type: Date, default: null },
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

FeeStructureSchema.index({ programId: 1, name: 1 });

export type HydratedFeeStructure = HydratedDocument<FeeStructureDoc>;

export const FeeStructure =
  (mongoose.models.FeeStructure as mongoose.Model<FeeStructureDoc> | undefined) ??
  model<FeeStructureDoc>('FeeStructure', FeeStructureSchema);
