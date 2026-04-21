import mongoose, { Schema, model, type Types } from 'mongoose';
import type { AuditAction } from 'india-learns-shared-types';

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId | null;
  action: AuditAction;
  targetType: string;
  targetId: Types.ObjectId | null;
  before: unknown;
  after: unknown;
  details: Record<string, unknown> | null;
  ip: string;
  ua: string;
  at: Date;
}

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    details: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    ua: { type: String, default: '' },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { versionKey: false },
);

AuditLogSchema.index({ actorUserId: 1, at: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, at: -1 });
AuditLogSchema.index({ at: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogDoc> | undefined) ??
  model<AuditLogDoc>('AuditLog', AuditLogSchema);
