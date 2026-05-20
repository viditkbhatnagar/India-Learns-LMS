import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatAttachmentDto,
  ChatMessageDto,
  ConversationDto,
} from 'india-learns-shared-types';
import { chatApi, filesApi } from '../lib/endpoints.js';
import { useAuthStore } from '../store/auth.js';
import { getChatSocket, disconnectChatSocket } from '../lib/chatSocket.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton, ErrorAlert, EmptyState } from '../components/ui/States.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { Badge } from '../components/ui/Badge.js';

// M10e/M10m — Chat page. Two-column layout: conversation list on the
// left, thread view on the right. Real-time via Socket.IO (M10m) with
// polling as a fallback when the socket is down — both refresh the same
// React Query caches, so any consumer (sidebar bell counts, thread
// scroll, conversation-list badges) updates uniformly.

const MESSAGE_POLL_MS = 5000;
const CONVERSATION_POLL_MS = 15000;

export function ChatPage() {
  const me = useAuthStore((s) => s.user)!;
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewPicker, setShowNewPicker] = useState(false);

  const conversationsQ = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatApi.listMyConversations(),
    refetchInterval: CONVERSATION_POLL_MS,
  });

  // M10m — Socket.IO push. When the server pings us with
  // `chat:conversation_touched` (someone sent a message to a
  // conversation we belong to), invalidate the list query — React Query
  // refetches once and every consumer (sidebar badges, this page's
  // conversation list) updates. `chat:membership_added` does the same
  // since a new conversation should appear in the sidebar.
  useEffect(() => {
    if (!token) return undefined;
    const socket = getChatSocket(token);
    const onTouched = (payload: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'messages', payload.conversationId] });
    };
    const onMembership = () => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    };
    socket.on('chat:conversation_touched', onTouched);
    socket.on('chat:membership_added', onMembership);
    return () => {
      socket.off('chat:conversation_touched', onTouched);
      socket.off('chat:membership_added', onMembership);
    };
  }, [token, qc]);

  // Disconnect on logout / page unmount when the auth token is cleared.
  useEffect(() => () => {
    if (!token) disconnectChatSocket();
  }, [token]);

  // Auto-pick first conversation when none selected.
  useEffect(() => {
    if (selectedId) return;
    const first = conversationsQ.data?.[0];
    if (first) setSelectedId(first.id);
  }, [conversationsQ.data, selectedId]);

  const selected = conversationsQ.data?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Communication"
        title="Chat"
        subtitle="Direct messages with faculty, students, and staff. Group chats per batch and file attachments are live."
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 min-h-[60vh]">
        {/* Sidebar — conversation list + new-message picker */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-brand-navy">Conversations</h2>
            <Button onClick={() => setShowNewPicker((v) => !v)}>
              {showNewPicker ? 'Close' : 'New'}
            </Button>
          </div>
          {showNewPicker && (
            <NewMessagePicker
              onPicked={(conv) => {
                setSelectedId(conv.id);
                setShowNewPicker(false);
              }}
            />
          )}
          {conversationsQ.isLoading && <Skeleton lines={3} />}
          {conversationsQ.isError && (
            <ErrorAlert
              message={(conversationsQ.error as Error).message}
              onRetry={() => conversationsQ.refetch()}
            />
          )}
          {conversationsQ.data && conversationsQ.data.length === 0 && !showNewPicker && (
            <EmptyState
              title="No conversations yet"
              message="Use “New” above to start a direct message."
            />
          )}
          {conversationsQ.data && conversationsQ.data.length > 0 && (
            <ul className="divide-y divide-black/5 -mx-2">
              {conversationsQ.data.map((c) => {
                const other = c.members.find((m) => m.userId !== me.id);
                const title = c.title ?? other?.name ?? 'Conversation';
                const subtitle =
                  c.lastMessage?.body?.slice(0, 80) ??
                  (c.kind === 'direct' ? other?.role ?? '' : 'Group');
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                        active ? 'bg-navy-50' : 'hover:bg-surface-muted/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-brand-navy truncate">{title}</span>
                        {c.unreadCount > 0 && (
                          <Badge tone="accent" size="sm">
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <span className="block text-xs text-muted truncate mt-0.5">
                        {subtitle || 'No messages yet'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Thread view */}
        {selected ? (
          <ThreadView conversation={selected} meId={me.id} />
        ) : (
          <Card>
            <EmptyState
              title="Pick a conversation"
              message="Select one from the list, or start a new direct message."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function NewMessagePicker({ onPicked }: { onPicked: (c: ConversationDto) => void }) {
  const [q, setQ] = useState('');
  const searchQ = useQuery({
    queryKey: ['chat', 'search', q],
    queryFn: () => chatApi.searchUsers(q),
    enabled: q.trim().length >= 2,
  });
  const qc = useQueryClient();

  async function pick(userId: string) {
    const conv = await chatApi.getOrCreateDirect(userId);
    qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    onPicked(conv);
  }

  return (
    <div className="mb-3 space-y-2 border-b border-black/5 pb-3">
      <Input
        label="Find someone"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name, email, or code"
      />
      {searchQ.data && searchQ.data.length > 0 && (
        <ul className="divide-y divide-black/5 max-h-48 overflow-y-auto">
          {searchQ.data.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => pick(u.id)}
                className="w-full text-left px-2 py-2 rounded hover:bg-surface-muted/60 transition-colors"
              >
                <span className="font-medium text-brand-navy">{u.name}</span>
                <span className="block text-xs text-muted">
                  {u.role} {u.code && `· ${u.code}`} · {u.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && searchQ.data && searchQ.data.length === 0 && (
        <p className="text-xs text-muted">No matches.</p>
      )}
    </div>
  );
}

function ThreadView({
  conversation,
  meId,
}: {
  conversation: ConversationDto;
  meId: string;
}) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ChatAttachmentDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messagesQ = useQuery({
    queryKey: ['chat', 'messages', conversation.id],
    queryFn: () => chatApi.listMessages(conversation.id),
    refetchInterval: MESSAGE_POLL_MS,
  });

  // M10m — Join the per-conversation socket room on mount so incoming
  // messages push instantly (no 5s wait). The poll above remains as a
  // safety net for stale-tab / offline / dropped-connection scenarios.
  useEffect(() => {
    if (!token) return undefined;
    const socket = getChatSocket(token);
    let joined = false;
    socket.emit('chat:join', conversation.id, (ok: boolean) => {
      joined = ok;
    });
    const onMessage = (msg: ChatMessageDto) => {
      if (msg.conversationId !== conversation.id) return;
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversation.id] });
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
      if (joined) socket.emit('chat:leave', conversation.id);
    };
  }, [conversation.id, token, qc]);

  // Auto-mark read on open + on new messages.
  useEffect(() => {
    chatApi.markRead(conversation.id).then(() => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    });
  }, [conversation.id, messagesQ.data?.length, qc]);

  // Auto-scroll to bottom on new message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQ.data?.length]);

  const other = conversation.members.find((m) => m.userId !== meId);
  const title = conversation.title ?? other?.name ?? 'Conversation';
  const subtitle = conversation.kind === 'direct' ? other?.role ?? '' : 'Group chat';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if ((!trimmed && pending.length === 0) || sending) return;
    setError(null);
    setSending(true);
    try {
      await chatApi.sendMessage(conversation.id, {
        body: trimmed,
        attachments: pending.length > 0 ? pending : undefined,
      });
      setBody('');
      setPending([]);
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversation.id] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send.');
    } finally {
      setSending(false);
    }
  }

  async function onPickFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { url } = await filesApi.upload(file, 'chat-attachments');
      setPending((prev) => [
        ...prev,
        {
          url,
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col" style={{ height: 'calc(60vh - 80px)' }}>
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2.5">
          {messagesQ.isLoading && <Skeleton lines={4} />}
          {messagesQ.isError && (
            <ErrorAlert
              message={(messagesQ.error as Error).message}
              onRetry={() => messagesQ.refetch()}
            />
          )}
          {messagesQ.data && messagesQ.data.length === 0 && (
            <EmptyState title="No messages yet" message="Send the first one." />
          )}
          {messagesQ.data?.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.senderId === meId} />
          ))}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={submit}
          className="mt-3 pt-3 border-t border-black/5 space-y-2"
        >
          {pending.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {pending.map((p, idx) => (
                <li
                  key={`${p.url}-${idx}`}
                  className="flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs"
                >
                  <span className="font-medium text-brand-navy truncate max-w-[200px]">
                    {p.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPending((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-muted hover:text-danger"
                    aria-label={`Remove ${p.filename}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <label
              htmlFor={`chat-attach-${conversation.id}`}
              className={`shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-black/10 text-brand-navy ${
                uploading || sending
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-surface-muted/60'
              }`}
              title="Attach a file (max 5 MB)"
              aria-label="Attach a file"
            >
              <input
                id={`chat-attach-${conversation.id}`}
                type="file"
                className="sr-only"
                disabled={uploading || sending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  e.target.value = '';
                }}
              />
              {uploading ? '…' : '📎'}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
              rows={2}
              className="flex-1 rounded-xl border border-black/10 px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(e);
                }
              }}
            />
            <Button
              type="submit"
              loading={sending}
              disabled={!body.trim() && pending.length === 0}
            >
              Send
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessageDto; mine: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
          mine
            ? 'bg-brand-navy text-white rounded-br-sm'
            : 'bg-surface-muted text-ink rounded-bl-sm'
        }`}
      >
        {!mine && message.senderName && (
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">
            {message.senderName}
            {message.senderRole && ` · ${message.senderRole}`}
          </p>
        )}
        {message.body && <p>{message.body}</p>}
        {message.attachments && message.attachments.length > 0 && (
          <ul className={`mt-1 space-y-1 ${message.body ? 'pt-1.5 border-t' : ''} ${
            mine ? 'border-white/20' : 'border-black/10'
          }`}>
            {message.attachments.map((a, idx) => (
              <li key={`${a.url}-${idx}`}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 underline ${
                    mine ? 'text-white' : 'text-brand-orange'
                  }`}
                >
                  <span aria-hidden>📎</span>
                  <span className="truncate max-w-[200px]">{a.filename}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-muted'}`}>
          {new Date(message.createdAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
