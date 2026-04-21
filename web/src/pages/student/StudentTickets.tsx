import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { TicketCategory, TicketPriority } from 'india-learns-shared-types';
import { ticketsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDateTime, formatRelative } from '../../lib/format.js';
import { ApiHttpError } from '../../lib/api.js';

const CATEGORIES: TicketCategory[] = ['academic', 'administration', 'finance', 'technical', 'complaints'];
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

function stateTone(state: string): 'success' | 'warning' | 'info' | 'neutral' | 'danger' {
  if (state === 'resolved' || state === 'closed') return 'success';
  if (state === 'in_progress') return 'warning';
  if (state === 'open') return 'info';
  return 'neutral';
}

export function StudentTickets() {
  const query = useQuery({ queryKey: ['me', 'tickets'], queryFn: ticketsApi.listMine });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">My tickets</h1>
        <Link to="/student/tickets/new">
          <Button>New ticket</Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No tickets yet"
            message="Raise a ticket for academic, administrative, finance or technical issues."
            action={
              <Link to="/student/tickets/new">
                <Button>Raise a ticket</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-black/5">
            {items.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/student/tickets/${t.id}`} className="font-medium text-brand-navy hover:underline truncate">
                      {t.subject}
                    </Link>
                    <span className="text-xs text-muted mono">{t.code}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {t.category} · {formatRelative(t.updatedAt)}
                    {t.slaResolveBreached && <span className="text-danger font-medium"> · SLA breached</span>}
                  </p>
                </div>
                <Badge tone={stateTone(t.state)}>{t.state}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function NewTicketPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('academic');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => ticketsApi.create({ subject, description, category, priority }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['me', 'tickets'] });
      navigate(`/student/tickets/${t.id}`);
    },
    onError: (err) => setError(err instanceof ApiHttpError ? err.message : 'Submission failed.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/student/tickets" className="text-sm text-brand-orange hover:underline">← Back to tickets</Link>
      <h1 className="text-2xl font-bold text-brand-navy">Raise a ticket</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-brand-navy mb-1.5">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-brand-navy mb-1.5">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
          <TextArea label="Describe the issue" value={description} onChange={(e) => setDescription(e.target.value)} required rows={6} />
          {category === 'complaints' && (
            <p className="text-xs text-muted">
              Complaints require a prior resolved or closed ticket. If this is your first issue, try another category first.
            </p>
          )}
          {error && <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">{error}</div>}
          <Button type="submit" loading={create.isPending}>Submit ticket</Button>
        </form>
      </Card>
    </div>
  );
}

export function StudentTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: () => ticketsApi.get(ticketId!),
    enabled: Boolean(ticketId),
  });
  const [comment, setComment] = useState('');
  const addComment = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId!, comment),
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['tickets', ticketId] });
    },
  });
  const reopen = useMutation({
    mutationFn: () => ticketsApi.requestReopen(ticketId!, 'Please reopen'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', ticketId] }),
  });

  if (query.isLoading) return <Skeleton lines={8} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const { ticket, comments } = query.data!;
  const canReopen =
    (ticket.state === 'resolved' || ticket.state === 'closed')
    && ticket.closedAt
    && Date.now() - new Date(ticket.closedAt).getTime() < 7 * 86_400_000;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/student/tickets" className="text-sm text-brand-orange hover:underline">← Back to tickets</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-navy">{ticket.subject}</h1>
        <Badge tone={stateTone(ticket.state)}>{ticket.state}</Badge>
      </div>
      <p className="text-sm text-muted">
        <span className="mono">{ticket.code}</span> · {ticket.category} · raised {formatIstDateTime(ticket.createdAt)}
      </p>
      <Card>
        <p className="whitespace-pre-wrap text-ink">{ticket.description}</p>
      </Card>
      <Card>
        <CardHeader title="Conversation" />
        {comments.length === 0 ? (
          <EmptyState title="No replies yet" message="You'll see staff responses here." />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-black/5 p-3 bg-brand-cream/40">
                <p className="text-xs text-muted mb-1">{formatIstDateTime(c.createdAt)}</p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {(ticket.state !== 'closed') && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) addComment.mutate();
            }}
            className="mt-4 space-y-2"
          >
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a reply…" rows={3} />
            <Button type="submit" size="sm" loading={addComment.isPending}>Post reply</Button>
          </form>
        )}
        {canReopen && (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => reopen.mutate()} loading={reopen.isPending}>
              Request reopen
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
