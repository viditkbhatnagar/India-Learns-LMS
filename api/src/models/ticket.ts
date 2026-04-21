import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type {
  TicketCategory,
  TicketPriority,
  TicketState,
} from 'india-learns-shared-types';

export interface TicketAttachmentDoc {
  url: string;
  name: string;
  size: number;
}

export interface TicketDoc {
  _id: Types.ObjectId;
  code: string;
  category: TicketCategory;
  priority: TicketPriority;
  studentId: Types.ObjectId;
  linkedCourseId: Types.ObjectId | null;
  linkedInvoiceId: Types.ObjectId | null;
  subject: string;
  description: string;
  state: TicketState;
  assigneeUserId: Types.ObjectId | null;
  assignedAt: Date | null;
  firstAckAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string;
  resolvedByUserId: Types.ObjectId | null;
  closedAt: Date | null;
  reopenedAt: Date | null;
  reopenedFromId: Types.ObjectId | null;
  parentTicketId: Types.ObjectId | null;
  slaAckDeadline: Date;
  slaResolveDeadline: Date;
  slaAckBreached: boolean;
  slaResolveBreached: boolean;
  slaAckBreachedAt: Date | null;
  slaResolveBreachedAt: Date | null;
  attachments: TicketAttachmentDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<TicketAttachmentDoc>(
  {
    url: { type: String, required: true, maxlength: 2048 },
    name: { type: String, required: true, maxlength: 240 },
    size: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const TicketSchema = new Schema<TicketDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    category: {
      type: String,
      enum: ['academic', 'administration', 'finance', 'technical', 'complaints'],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    linkedCourseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    linkedInvoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    subject: { type: String, required: true, maxlength: 240 },
    description: { type: String, required: true, maxlength: 8000 },
    state: {
      type: String,
      enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    assigneeUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    firstAckAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '', maxlength: 4000 },
    resolvedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
    reopenedFromId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    parentTicketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    slaAckDeadline: { type: Date, required: true },
    slaResolveDeadline: { type: Date, required: true },
    slaAckBreached: { type: Boolean, default: false },
    slaResolveBreached: { type: Boolean, default: false },
    slaAckBreachedAt: { type: Date, default: null },
    slaResolveBreachedAt: { type: Date, default: null },
    attachments: { type: [AttachmentSchema], default: [] },
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

// Cron scan: open/assigned/in_progress tickets ordered by resolve deadline.
TicketSchema.index({ state: 1, slaResolveDeadline: 1 });
// Student list view: newest first, scoped to one student.
TicketSchema.index({ studentId: 1, state: 1, createdAt: -1 });
// Staff queue: assigned tickets sorted by state.
TicketSchema.index({ assigneeUserId: 1, state: 1 });
// Category-level admin filters.
TicketSchema.index({ category: 1, state: 1 });

export type HydratedTicket = HydratedDocument<TicketDoc>;

export const Ticket =
  (mongoose.models.Ticket as mongoose.Model<TicketDoc> | undefined) ??
  model<TicketDoc>('Ticket', TicketSchema);
