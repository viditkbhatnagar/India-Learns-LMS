import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { AdmissionsAuditAction } from 'india-learns-shared-types';

// M5 — Separate, tamper-evident audit log for admissions actions (D-A4).
//
// Regular Mongo collection — not capped (capped is theater per Plan-agent
// review). Service-layer enforces append-only: there is no update or delete
// route exposed. Each row stores `chainHash = sha256(prevHash + canonicalJson(row))`
// so any tampering is detectable by re-computing the chain. The
// admissionsAuditHeadSnapshotJob persists the head hash off-row periodically
// (M9 will ship the cron; the service exposes the head-hash today).

export interface AdmissionsAuditLogDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId | null;
  actorUserId: Types.ObjectId | null;
  action: AdmissionsAuditAction;
  details: Record<string, unknown> | null;
  at: Date;
  prevHash: string | null;
  chainHash: string;
  createdAt: Date;
}

const AdmissionsAuditLogSchema = new Schema<AdmissionsAuditLogDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    details: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: () => new Date(), index: true },
    prevHash: { type: String, default: null },
    chainHash: { type: String, required: true, unique: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

AdmissionsAuditLogSchema.index({ applicationId: 1, at: -1 });

export type HydratedAdmissionsAuditLog = HydratedDocument<AdmissionsAuditLogDoc>;

export const AdmissionsAuditLog =
  (mongoose.models.AdmissionsAuditLog as
    | mongoose.Model<AdmissionsAuditLogDoc>
    | undefined) ??
  model<AdmissionsAuditLogDoc>('AdmissionsAuditLog', AdmissionsAuditLogSchema);

// ============================================================================
// ReviewerNote — officer-only annotations on an application. Append-only via
// the officer-side service in M5; visible to all officers + admins on the
// detail screen.
// ============================================================================

export interface ReviewerNoteDoc {
  _id: Types.ObjectId;
  applicationId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewerNoteSchema = new Schema<ReviewerNoteDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: { type: String, required: true, maxlength: 8000 },
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

ReviewerNoteSchema.index({ applicationId: 1, createdAt: 1 });

export type HydratedReviewerNote = HydratedDocument<ReviewerNoteDoc>;

export const ReviewerNote =
  (mongoose.models.ReviewerNote as mongoose.Model<ReviewerNoteDoc> | undefined) ??
  model<ReviewerNoteDoc>('ReviewerNote', ReviewerNoteSchema);
