import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { DomainEventType } from 'india-learns-shared-types';

export interface DomainEventDoc {
  _id: Types.ObjectId;
  type: DomainEventType;
  payload: Record<string, unknown>;
  publishedAt: Date;
  consumedAt: Date | null;
  consumerError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DomainEventSchema = new Schema<DomainEventDoc>(
  {
    type: {
      type: String,
      enum: ['course.completed', 'certificate.issued'],
      required: true,
      index: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    publishedAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    consumerError: { type: String, default: null, maxlength: 500 },
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

DomainEventSchema.index({ type: 1, consumedAt: 1, publishedAt: 1 });

export type HydratedDomainEvent = HydratedDocument<DomainEventDoc>;

export const DomainEvent =
  (mongoose.models.DomainEvent as mongoose.Model<DomainEventDoc> | undefined) ??
  model<DomainEventDoc>('DomainEvent', DomainEventSchema);
