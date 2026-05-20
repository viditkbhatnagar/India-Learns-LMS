// M10e — Internal chat (LMS_Requirements §2). DTOs for the foundation
// slice (PR-E1): 1:1 direct messaging only, polling-based. Groups + file
// upload + Socket.IO real-time land in PR-E2/E3.

export const CONVERSATION_KINDS = ['direct', 'group_batch'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  // Hydrated on list responses so the UI doesn't have to fan out to /users.
  senderName: string | null;
  senderRole: string | null;
  body: string;
  // File attachments — empty array on PR-E1; PR-E3 fills this.
  attachments: ChatAttachmentDto[];
  createdAt: string;
}

export interface ChatAttachmentDto {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ConversationMemberDto {
  userId: string;
  // Hydrated for the conversation list so the UI can render avatars +
  // names without a second fetch.
  name: string | null;
  role: string | null;
  // Whether this membership row has unread messages — derived from
  // membership.lastReadAt < conversation.lastMessageAt.
  hasUnread: boolean;
}

export interface ConversationDto {
  id: string;
  kind: ConversationKind;
  // For direct conversations: null. For group_batch: the batch name.
  title: string | null;
  // Foreign-key only set for `group_batch` conversations.
  batchId: string | null;
  members: ConversationMemberDto[];
  lastMessage: ChatMessageDto | null;
  // ISO timestamp of the newest message (or createdAt if none).
  lastMessageAt: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDirectConversationInput {
  // The other party — server enforces that the caller becomes the second
  // member. Existing direct conversations are returned rather than
  // duplicated.
  otherUserId: string;
}

export interface SendChatMessageInput {
  body: string;
  // PR-E1 ignores attachments; surface kept so PR-E3 doesn't break the
  // contract.
  attachments?: ChatAttachmentDto[];
}
