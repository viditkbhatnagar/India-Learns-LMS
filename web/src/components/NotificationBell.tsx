import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { chatApi, notificationsApi } from '../lib/endpoints.js';
import { formatRelative } from '../lib/format.js';
import { Badge } from './ui/Badge.js';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listQuery = useQuery({
    queryKey: ['notifications', 'me'],
    queryFn: () => notificationsApi.listMine({ limit: 20 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'me'] }),
  });
  // M10n — Sum chat unread alongside the in-app notification list so the
  // bell badge totals "things you should look at" across both surfaces.
  // Cheap: `chatApi.listMyConversations` already returns `unreadCount`
  // per conversation; we just sum. Refetches via the same poll cadence
  // plus push events from Chat.tsx invalidating the same cache key.
  const chatQuery = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatApi.listMyConversations(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const items = listQuery.data ?? [];
  const inAppUnread = items.filter((n) => !n.readAt).length;
  const chats = chatQuery.data ?? [];
  const chatUnread = chats.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const unreadCount = inAppUnread + chatUnread;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-white/10 text-white/90 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-brand-orange text-[10px] text-brand-navy font-semibold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-black/10 rounded-xl shadow-lg z-50 max-h-[80vh] overflow-y-auto"
          role="menu"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <p className="font-semibold text-brand-navy">Notifications</p>
            <Link to="/profile/notifications" className="text-xs text-brand-orange hover:underline" onClick={() => setOpen(false)}>
              Preferences
            </Link>
          </div>
          {/* M10n — Chat unread, surfaced as the first item when > 0 so it's
              visible above the time-ordered notifications list. */}
          {chatUnread > 0 && (
            <Link
              to="/chat"
              onClick={() => setOpen(false)}
              className="w-full text-left px-4 py-3 border-b border-black/5 bg-navy-50/40 hover:bg-navy-50 transition flex items-start gap-2"
            >
              <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full bg-brand-orange shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-brand-navy truncate">
                    {chatUnread} unread chat{chatUnread === 1 ? '' : 's'}
                  </p>
                  <Badge tone="accent" className="shrink-0">chat</Badge>
                </div>
                <p className="text-sm text-muted line-clamp-1">
                  {chats
                    .filter((c) => c.unreadCount > 0)
                    .slice(0, 3)
                    .map((c) => c.title ?? c.members.find((m) => m.userId)?.name ?? 'Conversation')
                    .join(', ')}
                </p>
              </div>
            </Link>
          )}
          {listQuery.isLoading && <div className="p-4 text-muted text-sm">Loading…</div>}
          {listQuery.isError && <div className="p-4 text-danger text-sm">Failed to load.</div>}
          {!listQuery.isLoading && items.length === 0 && (
            <div className="p-6 text-muted text-sm text-center">Nothing new.</div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.readAt && markRead.mutate(n.id)}
              className={clsx(
                'w-full text-left px-4 py-3 border-b border-black/5 last:border-b-0 hover:bg-brand-cream transition',
                !n.readAt && 'bg-amber-50/50',
              )}
            >
              <div className="flex items-start gap-2">
                {!n.readAt && <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full bg-brand-orange shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-brand-navy truncate">{n.title}</p>
                    <Badge tone="neutral" className="shrink-0">{n.type.split('.')[0]}</Badge>
                  </div>
                  <p className="text-sm text-muted line-clamp-2">{n.body}</p>
                  <p className="text-xs text-muted/80 mt-1">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
