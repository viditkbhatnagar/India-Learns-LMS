import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M10e — ConversationMembership. One row per (conversation, user) pair.
// Tracks `lastReadAt` for unread-count math: unread = messages whose
// createdAt > membership.lastReadAt. Updated whenever the user opens
// the conversation.

export interface ConversationMembershipDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  // 'member' for direct chat participants; 'admin' for whoever can
  // manage group membership (PR-E2). Defaults to 'member' for everyone
  // in PR-E1.
  role: 'member' | 'admin';
  joinedAt: Date;
  // Epoch-0 if the user hasn't opened the conversation yet → everything
  // counts as unread.
  lastReadAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMembershipSchema = new Schema<ConversationMembershipDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },
    joinedAt: { type: Date, default: () => new Date() },
    lastReadAt: { type: Date, default: () => new Date(0) },
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

// One membership per (conversation, user) — natural key.
ConversationMembershipSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true },
);
// User-side index for "all my conversations" queries.
ConversationMembershipSchema.index({ userId: 1, lastReadAt: 1 });

export type HydratedConversationMembership = HydratedDocument<ConversationMembershipDoc>;
export const ConversationMembership =
  (mongoose.models.ConversationMembership as
    | mongoose.Model<ConversationMembershipDoc>
    | undefined) ??
  model<ConversationMembershipDoc>(
    'ConversationMembership',
    ConversationMembershipSchema,
  );
