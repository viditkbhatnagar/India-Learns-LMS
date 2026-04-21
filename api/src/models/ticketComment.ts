import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { TicketCommentVisibility } from 'india-learns-shared-types';
import type { TicketAttachmentDoc } from './ticket.js';

export interface TicketCommentDoc {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  body: string;
  visibility: TicketCommentVisibility;
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

const TicketCommentSchema = new Schema<TicketCommentDoc>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: { type: String, required: true, maxlength: 8000 },
    visibility: {
      type: String,
      enum: ['public', 'internal'],
      default: 'public',
    },
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

TicketCommentSchema.index({ ticketId: 1, createdAt: 1 });

export type HydratedTicketComment = HydratedDocument<TicketCommentDoc>;

export const TicketComment =
  (mongoose.models.TicketComment as mongoose.Model<TicketCommentDoc> | undefined) ??
  model<TicketCommentDoc>('TicketComment', TicketCommentSchema);
