import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Types,
} from 'mongoose';
import type { ApiCostProvider } from 'india-learns-shared-types';

// M8 — per-event cost counter (PRD §15 "record usage counters internally and
// multiply by known rates"). One row per adapter call. `unitPaise` is snapshot
// at write time so historical aggregates stay stable when rates change.
export interface ApiCostLedgerDoc {
  _id: Types.ObjectId;
  provider: ApiCostProvider;
  operation: string; // e.g. 'email.send', 'whatsapp.template', 'certifier.issue'
  units: number;
  unitPaise: number;
  atUtc: Date;
  refType: string | null;
  refId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiCostLedgerSchema = new Schema<ApiCostLedgerDoc>(
  {
    provider: {
      type: String,
      enum: ['email', 'whatsapp', 'storage', 'certifier'],
      required: true,
    },
    operation: { type: String, required: true, maxlength: 100 },
    units: { type: Number, default: 1, min: 0 },
    unitPaise: { type: Number, required: true, min: 0 },
    atUtc: { type: Date, required: true },
    refType: { type: String, default: null, maxlength: 50 },
    refId: { type: Schema.Types.ObjectId, default: null },
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

ApiCostLedgerSchema.index({ atUtc: -1, provider: 1 });
ApiCostLedgerSchema.index({ provider: 1, atUtc: -1 });

export type HydratedApiCostLedger = HydratedDocument<ApiCostLedgerDoc>;

export const ApiCostLedger =
  (mongoose.models.ApiCostLedger as
    | mongoose.Model<ApiCostLedgerDoc>
    | undefined) ??
  model<ApiCostLedgerDoc>('ApiCostLedger', ApiCostLedgerSchema);
