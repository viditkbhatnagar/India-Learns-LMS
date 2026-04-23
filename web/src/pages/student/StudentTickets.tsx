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
  if (state === 'assigned') return 'info';
  return 'neutral';
}

export function StudentTickets() {
  const query = useQuery({ queryKey: ['me', 'tickets'], queryFn: ticketsApi.listMine });
  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const items = query.data ?? [];
  const open = items.filter((t) => t.state !== 'closed' && t.state !== 'resolved').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
            Support
          </p>
          <h1 className="text-display-sm text-brand-navy">Tickets</h1>
          <p className="mt-2 text-muted">
            {items.length} total · {open} open
          </p>
        </div>
        <Link to="/student/tickets/new">
          <Button size="lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            New ticket
          </Button>
        </Link>
      </header>

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
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-black/5">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/student/tickets/${t.id}`}
                  className="flex items-center gap-4 p-4 sm:p-5 hover:bg-surface-muted/70 transition-colors group"
                >
                  <span
                    aria-hidden
                    className={`shrink-0 h-10 w-10 rounded-xl grid place-items-center ${
                      t.state === 'resolved' || t.state === 'closed'
                        ? 'bg-emerald-50 text-success border border-emerald-200'
                        : t.slaResolveBreached
                          ? 'bg-red-50 text-danger border border-red-200'
                          : 'bg-navy-50 text-brand-navy border border-navy-100'
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors truncate">
                        {t.subject}
                      </p>
                      <span className="text-xs text-muted font-mono shrink-0">{t.code}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 capitalize">
                      {t.category} · {formatRelative(t.updatedAt)}
                      {t.slaResolveBreached && (
                        <span className="text-danger font-semibold"> · SLA breached</span>
                      )}
                    </p>
                  </div>
                  <Badge tone={stateTone(t.state)} dot>
                    {t.state}
                  </Badge>
                </Link>
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
    <div className="space-y-6 max-w-2xl animate-fade-in-up">
      <div>
        <Link
          to="/student/tickets"
          className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
        >
          ← Back to tickets
        </Link>
        <h1 className="text-display-sm text-brand-navy mt-3">Raise a ticket</h1>
        <p className="mt-2 text-muted">
          Staff aim to acknowledge within 24 hours and resolve within 5 business days.
        </p>
      </div>
      <Card accent="orange">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Category"
              value={category}
              onChange={(v) => setCategory(v as TicketCategory)}
              options={CATEGORIES}
            />
            <SelectField
              label="Priority"
              value={priority}
              onChange={(v) => setPriority(v as TicketPriority)}
              options={PRIORITIES}
            />
          </div>
          <Input
            label="Subject"
            placeholder="Short summary of the issue"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={200}
          />
          <TextArea
            label="Describe the issue"
            placeholder="Add any details that will help us help you faster…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={6}
          />
          {category === 'complaints' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-warning p-3 text-sm">
              Complaints require a prior resolved or closed ticket. If this is your first issue, try another category first.
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm"
            >
              {error}
            </div>
          )}
          <Button type="submit" size="lg" loading={create.isPending}>
            Submit ticket
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all capitalize"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
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

  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const { ticket, comments } = query.data!;
  const canReopen =
    (ticket.state === 'resolved' || ticket.state === 'closed')
    && ticket.closedAt
    && Date.now() - new Date(ticket.closedAt).getTime() < 7 * 86_400_000;

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in-up">
      <div>
        <Link
          to="/student/tickets"
          className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
        >
          ← Back to tickets
        </Link>
        <div className="mt-3 flex items-start gap-3 flex-wrap">
          <h1 className="text-display-sm text-brand-navy">{ticket.subject}</h1>
          <Badge tone={stateTone(ticket.state)} dot size="md">
            {ticket.state}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-mono">{ticket.code}</span> · {ticket.category} · raised{' '}
          {formatIstDateTime(ticket.createdAt)}
        </p>
      </div>

      <Card accent="navy">
        <CardHeader title="Original message" />
        <p className="whitespace-pre-wrap text-ink leading-relaxed max-w-[68ch]">{ticket.description}</p>
      </Card>

      <Card>
        <CardHeader title="Conversation" subtitle="Staff replies + your follow-ups" />
        {comments.length === 0 ? (
          <EmptyState title="No replies yet" message="You'll see staff responses here as they come in." />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-xl border border-black/5 p-4 bg-surface-muted">
                <p className="text-xs text-muted mb-1.5 font-medium">
                  {formatIstDateTime(c.createdAt)}
                </p>
                <p className="whitespace-pre-wrap text-ink leading-relaxed max-w-[68ch]">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {ticket.state !== 'closed' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (comment.trim()) addComment.mutate();
            }}
            className="mt-5 space-y-3"
          >
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a reply…"
              rows={3}
            />
            <Button type="submit" size="md" loading={addComment.isPending}>
              Post reply
            </Button>
          </form>
        )}
        {canReopen && (
          <div className="mt-5 rounded-xl bg-surface-muted p-4">
            <p className="text-sm text-muted mb-3">
              If this issue came back, you can ask staff to reopen the ticket within 7 days of closure.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => reopen.mutate()}
              loading={reopen.isPending}
            >
              Request reopen
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
