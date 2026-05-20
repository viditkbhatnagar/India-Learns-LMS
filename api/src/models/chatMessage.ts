import mongoose, { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// M10e — ChatMessage. One row per message; attachments are inline subdocs
// (one ChatMessage can carry multiple files in PR-E3). Soft-deletable
// via deletedAt — staff might need to remove a message but we keep the
// audit row.

export interface ChatAttachmentDoc {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ChatMessageDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  attachments: ChatAttachmentDoc[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatAttachmentSchema = new Schema<ChatAttachmentDoc>(
  {
    url: { type: String, required: true, maxlength: 1024 },
    filename: { type: String, required: true, maxlength: 256 },
    sizeBytes: { type: Number, required: true, min: 0 },
    mimeType: { type: String, required: true, maxlength: 128 },
  },
  { _id: false },
);

const ChatMessageSchema = new Schema<ChatMessageDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    body: { type: String, default: '', maxlength: 8000 },
    attachments: { type: [ChatAttachmentSchema], default: [] },
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

// List-messages-for-conversation hot path: (conversationId, createdAt).
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
// Polling: "messages since lastSeen" queries on (conversationId, createdAt).

export type HydratedChatMessage = HydratedDocument<ChatMessageDoc>;
export const ChatMessage =
  (mongoose.models.ChatMessage as mongoose.Model<ChatMessageDoc> | undefined) ??
  model<ChatMessageDoc>('ChatMessage', ChatMessageSchema);
