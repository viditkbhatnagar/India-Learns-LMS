import { Types } from 'mongoose';
import type {
  ChatMessageDto,
  ConversationDto,
  ConversationMemberDto,
  SendChatMessageInput,
} from 'india-learns-shared-types';
import { HttpError } from '../middleware/error.js';
import {
  Batch,
  ChatMessage,
  Conversation,
  ConversationMembership,
  User,
  type HydratedChatMessage,
  type HydratedConversation,
} from '../models/index.js';
import {
  emitConversationTouched,
  emitMembershipAdded,
  emitMessage,
} from '../chat/socketServer.js';

// M10e — Internal chat service (PR-E1). 1:1 direct conversations,
// polling-based delivery. Group chat + Socket.IO + file upload land
// in PR-E2/E3.

function pairKey(a: Types.ObjectId, b: Types.ObjectId): string {
  const [low, high] = [a.toString(), b.toString()].sort();
  return `${low}::${high}`;
}

// ---------- DTO helpers ---------------------------------------------

interface UserRef {
  name: string | null;
  role: string | null;
}

function toMessageDto(
  doc: HydratedChatMessage,
  senderRef: UserRef = { name: null, role: null },
): ChatMessageDto {
  return {
    id: doc._id.toString(),
    conversationId: doc.conversationId.toString(),
    senderId: doc.senderId.toString(),
    senderName: senderRef.name,
    senderRole: senderRef.role,
    body: doc.body,
    attachments: (doc.attachments ?? []).map((a) => ({
      url: a.url,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      mimeType: a.mimeType,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

async function toConversationDto(
  conv: HydratedConversation,
  forUserId: Types.ObjectId,
): Promise<ConversationDto> {
  // Members + their User rows
  const memberships = await ConversationMembership.find({ conversationId: conv._id });
  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select({ name: 1, role: 1 })
    .lean();
  const userMap = new Map(
    users.map((u) => [String(u._id), { name: u.name as string, role: u.role as string }]),
  );

  // Last message + sender hydration
  const last = await ChatMessage.findOne({ conversationId: conv._id, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(1);

  const myMembership = memberships.find((m) => m.userId.equals(forUserId));
  const lastReadAt = myMembership?.lastReadAt ?? new Date(0);
  const unreadCount = await ChatMessage.countDocuments({
    conversationId: conv._id,
    senderId: { $ne: forUserId },
    createdAt: { $gt: lastReadAt },
    deletedAt: null,
  });

  const members: ConversationMemberDto[] = memberships.map((m) => {
    const ref = userMap.get(String(m.userId));
    const memberLastRead = m.lastReadAt;
    return {
      userId: m.userId.toString(),
      name: ref?.name ?? null,
      role: ref?.role ?? null,
      hasUnread: conv.lastMessageAt.getTime() > memberLastRead.getTime(),
    };
  });

  return {
    id: conv._id.toString(),
    kind: conv.kind,
    title: conv.title,
    batchId: conv.batchId ? conv.batchId.toString() : null,
    members,
    lastMessage: last
      ? toMessageDto(last, userMap.get(String(last.senderId)) ?? { name: null, role: null })
      : null,
    lastMessageAt: conv.lastMessageAt.toISOString(),
    unreadCount,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  };
}

// ---------- Public API ----------------------------------------------

export async function listMyConversations(
  userId: Types.ObjectId,
): Promise<ConversationDto[]> {
  const memberships = await ConversationMembership.find({ userId }).select({
    conversationId: 1,
  });
  const conversationIds = memberships.map((m) => m.conversationId);
  const convs = await Conversation.find({
    _id: { $in: conversationIds },
    deletedAt: null,
  }).sort({ lastMessageAt: -1 });
  return Promise.all(convs.map((c) => toConversationDto(c, userId)));
}

export async function getOrCreateDirectConversation(
  callerId: Types.ObjectId,
  otherIdStr: string,
): Promise<ConversationDto> {
  if (!Types.ObjectId.isValid(otherIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }
  const otherId = new Types.ObjectId(otherIdStr);
  if (otherId.equals(callerId)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'You cannot start a conversation with yourself.',
    );
  }
  const otherUser = await User.findById(otherId)
    .select({ status: 1 })
    .lean();
  if (!otherUser || otherUser.status === 'revoked') {
    throw new HttpError(404, 'NOT_FOUND', 'User not found.');
  }

  const key = pairKey(callerId, otherId);
  const existing = await Conversation.findOne({ directPairKey: key, deletedAt: null });
  if (existing) {
    return toConversationDto(existing, callerId);
  }

  // Upsert via the unique pair-key index — two clients racing to create
  // the same conversation lose to one another but both come out with
  // the same row.
  let created: HydratedConversation;
  try {
    created = await Conversation.create({
      kind: 'direct',
      title: null,
      batchId: null,
      directPairKey: key,
      lastMessageAt: new Date(),
      createdBy: callerId,
    });
  } catch (err) {
    // Duplicate key on a race — refetch the winner.
    const winner = await Conversation.findOne({ directPairKey: key, deletedAt: null });
    if (!winner) throw err;
    return toConversationDto(winner, callerId);
  }

  await ConversationMembership.insertMany(
    [callerId, otherId].map((uid) => ({
      conversationId: created._id,
      userId: uid,
      role: 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(0),
    })),
  );
  return toConversationDto(created, callerId);
}

async function assertMembership(
  conversationId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<void> {
  const member = await ConversationMembership.findOne({ conversationId, userId });
  if (!member) {
    throw new HttpError(403, 'FORBIDDEN', 'You are not a member of this conversation.');
  }
}

export async function listMessages(
  conversationIdStr: string,
  userId: Types.ObjectId,
  since: Date | null,
  limit = 100,
): Promise<ChatMessageDto[]> {
  if (!Types.ObjectId.isValid(conversationIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Conversation not found.');
  }
  const conversationId = new Types.ObjectId(conversationIdStr);
  await assertMembership(conversationId, userId);

  const filter: Record<string, unknown> = { conversationId, deletedAt: null };
  if (since) filter.createdAt = { $gt: since };

  const docs = await ChatMessage.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 500));

  // Hydrate sender names in one query.
  const senderIds = [...new Set(docs.map((d) => String(d.senderId)))].map(
    (s) => new Types.ObjectId(s),
  );
  const senders = await User.find({ _id: { $in: senderIds } })
    .select({ name: 1, role: 1 })
    .lean();
  const senderMap = new Map(
    senders.map((s) => [String(s._id), { name: s.name as string, role: s.role as string }]),
  );

  // Return oldest-first for natural reading order.
  return docs
    .reverse()
    .map((d) =>
      toMessageDto(d, senderMap.get(String(d.senderId)) ?? { name: null, role: null }),
    );
}

export async function sendMessage(
  conversationIdStr: string,
  senderId: Types.ObjectId,
  input: SendChatMessageInput,
): Promise<ChatMessageDto> {
  if (!Types.ObjectId.isValid(conversationIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Conversation not found.');
  }
  const conversationId = new Types.ObjectId(conversationIdStr);
  await assertMembership(conversationId, senderId);

  const body = input.body.trim();
  if (!body && (!input.attachments || input.attachments.length === 0)) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Message body cannot be empty.',
    );
  }

  const doc = await ChatMessage.create({
    conversationId,
    senderId,
    body,
    // PR-E1: attachments accepted but UI doesn't yet attach files. PR-E3
    // wires the Cloudinary upload + size/mime gates.
    attachments: input.attachments ?? [],
  });

  // Bump the conversation's lastMessageAt + the sender's lastReadAt so
  // their own send doesn't count as unread for themselves.
  await Promise.all([
    Conversation.updateOne(
      { _id: conversationId },
      { $set: { lastMessageAt: doc.createdAt } },
    ),
    ConversationMembership.updateOne(
      { conversationId, userId: senderId },
      { $set: { lastReadAt: doc.createdAt } },
    ),
  ]);

  const sender = await User.findById(senderId).select({ name: 1, role: 1 }).lean();
  const dto = toMessageDto(doc, {
    name: (sender?.name as string) ?? null,
    role: (sender?.role as string) ?? null,
  });

  // M10m — Real-time push. Emit to everyone joined to the conversation
  // room (those who currently have the thread open), and ping every
  // member's per-user room so their conversation-list refreshes the
  // unread badge even when the thread isn't open.
  emitMessage(conversationId.toString(), dto as unknown as Record<string, unknown>);
  const members = await ConversationMembership.find({ conversationId })
    .select({ userId: 1 })
    .lean();
  emitConversationTouched(
    members.map((m: { userId: Types.ObjectId }) => m.userId.toString()),
    conversationId.toString(),
  );

  return dto;
}

export async function markRead(
  conversationIdStr: string,
  userId: Types.ObjectId,
): Promise<void> {
  if (!Types.ObjectId.isValid(conversationIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Conversation not found.');
  }
  const conversationId = new Types.ObjectId(conversationIdStr);
  await ConversationMembership.updateOne(
    { conversationId, userId },
    { $set: { lastReadAt: new Date() } },
  );
}

// ---------- Group chat (M10m) --------------------------------------

// Ensures a single `group_batch` conversation exists for a given batch
// + the caller is a member of it. Auto-membership is added on first
// access for any active student in the batch; this is how the batch
// group "auto-appears" for students post-enrolment without a separate
// migration job.
export async function getOrCreateBatchGroupConversation(
  batchIdStr: string,
  callerId: Types.ObjectId,
  callerRole: string,
): Promise<ConversationDto> {
  if (!Types.ObjectId.isValid(batchIdStr)) {
    throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  }
  const batchId = new Types.ObjectId(batchIdStr);
  const batch = await Batch.findById(batchId);
  if (!batch || batch.deletedAt) {
    throw new HttpError(404, 'NOT_FOUND', 'Batch not found.');
  }

  // Eligibility: the caller must be enrolled in the batch (student) OR
  // be staff (faculty/admin/superadmin/admissions_officer).
  const isStaff = ['faculty', 'admin', 'superadmin', 'admissions_officer'].includes(
    callerRole,
  );
  const isMemberOfBatch = await User.exists({ _id: callerId, batchId });
  if (!isStaff && !isMemberOfBatch) {
    throw new HttpError(403, 'FORBIDDEN', 'You are not a member of this batch.');
  }

  let conv = await Conversation.findOne({
    kind: 'group_batch',
    batchId,
    deletedAt: null,
  });
  if (!conv) {
    try {
      conv = await Conversation.create({
        kind: 'group_batch',
        title: batch.name,
        batchId,
        directPairKey: null,
        lastMessageAt: new Date(),
        createdBy: callerId,
      });
    } catch {
      const winner = await Conversation.findOne({
        kind: 'group_batch',
        batchId,
        deletedAt: null,
      });
      if (!winner) throw new HttpError(500, 'INTERNAL_ERROR', 'Could not create group.');
      conv = winner;
    }
  }

  // Ensure the caller is a member — add lazily.
  const existingMembership = await ConversationMembership.findOne({
    conversationId: conv._id,
    userId: callerId,
  });
  if (!existingMembership) {
    await ConversationMembership.create({
      conversationId: conv._id,
      userId: callerId,
      role: isStaff ? 'admin' : 'member',
      joinedAt: new Date(),
      lastReadAt: new Date(0),
    });
    emitMembershipAdded(callerId.toString(), conv._id.toString());
  }

  // Also lazily add every active student of the batch — this is the
  // "group auto-appears for the whole batch" behaviour. Idempotent via
  // the unique compound index.
  const batchStudents = await User.find({ batchId, role: 'student', status: 'active' })
    .select({ _id: 1 })
    .lean();
  if (batchStudents.length > 0) {
    const existingIds = new Set(
      (await ConversationMembership.find({ conversationId: conv._id })
        .select({ userId: 1 })
        .lean()).map((m: { userId: Types.ObjectId }) => m.userId.toString()),
    );
    const toAdd = batchStudents
      .filter((s) => !existingIds.has(String(s._id)))
      .map((s) => ({
        conversationId: conv!._id,
        userId: s._id,
        role: 'member' as const,
        joinedAt: new Date(),
        lastReadAt: new Date(0),
      }));
    if (toAdd.length > 0) {
      try {
        await ConversationMembership.insertMany(toAdd, { ordered: false });
        for (const m of toAdd) emitMembershipAdded(m.userId.toString(), conv._id.toString());
      } catch {
        // Duplicate-key racing inserts — fine, just continue.
      }
    }
  }

  return toConversationDto(conv, callerId);
}

// ---------- Search users to start a chat with -----------------------

export interface ChatSearchResult {
  id: string;
  name: string;
  role: string;
  email: string;
  code: string | null;
}

export async function searchChatTargets(
  callerId: Types.ObjectId,
  q: string,
): Promise<ChatSearchResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const safe = trimmed.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  // Anyone not deleted, not the caller. Status restriction: omit
  // applicants since they predate enrolment.
  const docs = await User.find({
    _id: { $ne: callerId },
    deletedAt: null,
    role: { $in: ['student', 'faculty', 'admin', 'superadmin', 'admissions_officer'] },
    $or: [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { code: { $regex: safe, $options: 'i' } },
    ],
  })
    .select({ name: 1, role: 1, email: 1, code: 1 })
    .limit(20)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name as string,
    role: d.role as string,
    email: d.email as string,
    code: (d.code as string | null) ?? null,
  }));
}
