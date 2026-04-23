import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TicketCommentDto,
  TicketDto,
  TicketState,
} from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { ticketsApi, usersApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

export function AdminTicketDetailPage() {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
    enabled: !!ticketId,
  });
  const staffQ = useQuery({
    queryKey: ['admin', 'ticket-staff'],
    queryFn: async () => {
      const roles = ['admin', 'superadmin', 'faculty', 'finance'] as const;
      const lists = await Promise.all(roles.map((r) => usersApi.list({ role: r })));
      return lists.flat();
    },
  });
  const [comment, setComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [transitionTo, setTransitionTo] = useState<TicketState>('assigned');
  const [transitionNote, setTransitionNote] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const addComment = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, comment, commentVisibility),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] });
    },
  });
  const transition = useMutation({
    mutationFn: () => ticketsApi.transition(ticketId, { to: transitionTo, note: transitionNote }),
    onSuccess: () => {
      setTransitionNote('');
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] });
    },
  });
  const assign = useMutation({
    mutationFn: () => ticketsApi.assign(ticketId, assigneeId || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] });
    },
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} />;
  if (!q.data) return null;
  const { ticket, comments } = q.data as { ticket: TicketDto; comments: TicketCommentDto[] };

  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/admin/tickets" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <div>
        <p className="font-mono text-xs text-muted">{ticket.code}</p>
        <h1 className="text-display-sm text-brand-navy tracking-tight">{ticket.subject}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge tone="info">{ticket.category}</Badge>
          <Badge tone={ticket.state === 'closed' ? 'success' : 'warning'}>{ticket.state}</Badge>
          {ticket.slaAckBreached && <Badge tone="danger">SLA ack breach</Badge>}
          {ticket.slaResolveBreached && <Badge tone="danger">SLA resolve breach</Badge>}
        </div>
      </div>
      <Card>
        <p className="text-sm whitespace-pre-wrap max-w-[68ch]">{ticket.description}</p>
      </Card>
      <Card>
        <CardHeader
          title="Conversation"
          subtitle="Public replies are visible to the student; internal notes are staff-only."
        />
        {comments.length === 0 ? (
          <EmptyState title="No comments yet" />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => {
              const internal = c.visibility === 'internal';
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border p-4 ${
                    internal
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-black/5 bg-surface-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-muted">
                    <span className="font-mono">{c.authorUserId.slice(-6)}</span>
                    <span>·</span>
                    <span>{formatIstDateTime(c.createdAt)}</span>
                    <Badge tone={internal ? 'warning' : 'info'} size="sm" dot>
                      {internal ? 'Internal' : 'Public'}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-ink leading-relaxed max-w-[68ch]">{c.body}</p>
                </li>
              );
            })}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) addComment.mutate();
          }}
          className="mt-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-brand-navy">Visibility:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                checked={commentVisibility === 'public'}
                onChange={() => setCommentVisibility('public')}
                className="accent-brand-orange"
              />
              <span>Public (student sees this)</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer ml-4">
              <input
                type="radio"
                name="visibility"
                checked={commentVisibility === 'internal'}
                onChange={() => setCommentVisibility('internal')}
                className="accent-brand-orange"
              />
              <span>Internal (staff only)</span>
            </label>
          </div>
          <TextArea
            label={commentVisibility === 'internal' ? 'Add an internal note' : 'Add a public reply'}
            placeholder={
              commentVisibility === 'internal'
                ? 'Visible to admin/faculty/finance only'
                : 'The student will see this'
            }
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button type="submit" loading={addComment.isPending} disabled={!comment.trim()}>
            Post {commentVisibility === 'internal' ? 'internal note' : 'public reply'}
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader
          title="Assign"
          subtitle={
            ticket.assigneeUserId
              ? `Currently assigned to ${ticket.assigneeUserId.slice(-6)}`
              : 'Currently unassigned'
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
          className="flex flex-col sm:flex-row gap-3 items-end"
        >
          <label className="block flex-1">
            <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
              New assignee
            </span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="">— Unassign —</option>
              {(staffQ.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" loading={assign.isPending}>
            Reassign
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Change state" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            transition.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">New state</span>
            <select
              value={transitionTo}
              onChange={(e) => setTransitionTo(e.target.value as TicketState)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              {(['open','assigned','awaiting_student','in_progress','resolved','closed'] as TicketState[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <Input
            label="Note (optional)"
            value={transitionNote}
            onChange={(e) => setTransitionNote(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" loading={transition.isPending}>Apply</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
