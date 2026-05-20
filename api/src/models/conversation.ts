import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { CONVERSATION_KINDS, type ConversationKind } from 'india-learns-shared-types';

// M10e — Conversation. Two kinds in PR-E1: `direct` (always 2 members)
// and `group_batch` (one per batch, auto-created on first message).
//
// For direct conversations, we de-dup via the sorted-member-pair index
// (membership collection enforces uniqueness; this collection just stores
// the conversation row). `lastMessageAt` is denormalised so the
// conversation list can sort efficiently without an aggregation per row.

export interface ConversationDoc {
  _id: Types.ObjectId;
  kind: ConversationKind;
  title: string | null;
  batchId: Types.ObjectId | null;
  // For direct conversations only — a sorted, joined `${a}::${b}` of the
  // two userIds. Used as a unique key so re-creating returns the
  // existing row instead of duplicating.
  directPairKey: string | null;
  lastMessageAt: Date;
  createdBy: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<ConversationDoc>(
  {
    kind: {
      type: String,
      enum: CONVERSATION_KINDS,
      required: true,
      index: true,
    },
    title: { type: String, default: null, maxlength: 200 },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
      index: true,
    },
    directPairKey: { type: String, default: null },
    lastMessageAt: { type: Date, default: () => new Date(), index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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

// Direct conversations: unique on the sorted pair key. Partial index so
// group conversations (where directPairKey is null) aren't constrained.
ConversationSchema.index(
  { directPairKey: 1 },
  {
    unique: true,
    partialFilterExpression: { directPairKey: { $type: 'string' } },
  },
);
// One group_batch conversation per batch (similar partial index).
ConversationSchema.index(
  { batchId: 1, kind: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: 'group_batch' },
  },
);

export type HydratedConversation = HydratedDocument<ConversationDoc>;
export const Conversation =
  (mongoose.models.Conversation as
    | mongoose.Model<ConversationDoc>
    | undefined) ??
  model<ConversationDoc>('Conversation', ConversationSchema);
