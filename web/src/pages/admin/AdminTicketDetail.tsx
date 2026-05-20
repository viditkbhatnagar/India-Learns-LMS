import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DeptTag,
  TicketCommentDto,
  TicketDto,
  TicketState,
  UserPublicDto,
} from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { ticketsApi, usersApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

const DEPT_OPTIONS: { value: DeptTag | 'all'; label: string }[] = [
  { value: 'all', label: 'All departments' },
  { value: 'operations', label: 'Operations' },
  { value: 'it', label: 'IT' },
  { value: 'academics', label: 'Academics' },
  { value: 'finance', label: 'Finance' },
  { value: 'senior_mgmt', label: 'Senior management' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';
}

function formatStaffLabel(u: UserPublicDto): string {
  const dept = u.deptTag ? ` · ${u.deptTag.replace('_', ' ')}` : '';
  return `${u.name} — ${u.role}${dept}`;
}

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
      const roles = ['admin', 'superadmin', 'faculty'] as const;
      const lists = await Promise.all(roles.map((r) => usersApi.list({ role: r })));
      return lists.flat();
    },
  });

  const [comment, setComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [transitionTo, setTransitionTo] = useState<TicketState>('assigned');
  const [transitionNote, setTransitionNote] = useState('');

  // Assign picker state.
  const [deptFilter, setDeptFilter] = useState<DeptTag | 'all'>('all');
  const [staffQuery, setStaffQuery] = useState('');
  const [primaryId, setPrimaryId] = useState<string>('');
  const [coAssigneeIds, setCoAssigneeIds] = useState<string[]>([]);

  // Seed the pickers from the ticket once it loads.
  useEffect(() => {
    if (q.data?.ticket) {
      setPrimaryId(q.data.ticket.assigneeUserId ?? '');
      setCoAssigneeIds(q.data.ticket.coAssigneeUserIds ?? []);
    }
  }, [q.data?.ticket]);

  const staffById = useMemo(() => {
    const map = new Map<string, UserPublicDto>();
    for (const u of staffQ.data ?? []) map.set(u.id, u);
    return map;
  }, [staffQ.data]);

  const filteredStaff = useMemo(() => {
    const needle = staffQuery.trim().toLowerCase();
    return (staffQ.data ?? []).filter((u) => {
      if (deptFilter !== 'all' && u.deptTag !== deptFilter) return false;
      if (!needle) return true;
      return (
        u.name.toLowerCase().includes(needle)
        || u.email.toLowerCase().includes(needle)
        || u.role.toLowerCase().includes(needle)
      );
    });
  }, [staffQ.data, staffQuery, deptFilter]);

  const addComment = useMutation({
    mutationFn: () =>
      ticketsApi.addComment(
        ticketId,
        comment,
        commentVisibility,
        mentionIds.length > 0 ? mentionIds : undefined,
      ),
    onSuccess: () => {
      setComment('');
      setMentionIds([]);
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
    mutationFn: () =>
      ticketsApi.assign(
        ticketId,
        primaryId || null,
        coAssigneeIds.filter((id) => id !== primaryId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', ticketId] });
    },
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} />;
  if (!q.data) return null;
  const { ticket, comments } = q.data as { ticket: TicketDto; comments: TicketCommentDto[] };

  const primaryStaff = primaryId ? staffById.get(primaryId) : null;
  const coAssigneeStaff = coAssigneeIds
    .map((id) => staffById.get(id))
    .filter((u): u is UserPublicDto => Boolean(u));

  function toggleCoAssignee(id: string): void {
    if (id === primaryId) return;
    setCoAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleMention(id: string): void {
    setMentionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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

          <div className="rounded-xl border border-black/10 bg-white/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Tag staff (@mention)
              </span>
              {mentionIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMentionIds([])}
                  className="text-xs text-muted hover:text-brand-navy underline"
                >
                  Clear
                </button>
              )}
            </div>
            {mentionIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mentionIds.map((id) => {
                  const u = staffById.get(id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-navy-100 text-brand-navy px-2.5 py-1"
                    >
                      @{u?.name ?? id.slice(-6)}
                      <button
                        type="button"
                        onClick={() => toggleMention(id)}
                        className="hover:text-brand-orange"
                        aria-label={`Remove mention of ${u?.name ?? 'user'}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto rounded-lg border border-black/5 divide-y divide-black/5">
              {(staffQ.data ?? [])
                .filter((u) => u.id !== ticket.assigneeUserId || mentionIds.includes(u.id))
                .slice(0, 40)
                .map((u) => {
                  const checked = mentionIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMention(u.id)}
                        className="accent-brand-orange"
                      />
                      <span className="font-semibold text-brand-navy">{u.name}</span>
                      <span className="text-xs text-muted">
                        {u.role}
                        {u.deptTag ? ` · ${u.deptTag.replace('_', ' ')}` : ''}
                      </span>
                    </label>
                  );
                })}
            </div>
            <p className="text-xs text-muted mt-1.5">
              Tagged users get a notification even if they aren't assigned.
            </p>
          </div>

          <Button type="submit" loading={addComment.isPending} disabled={!comment.trim()}>
            Post {commentVisibility === 'internal' ? 'internal note' : 'public reply'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Assign"
          subtitle={
            primaryStaff
              ? `Primary: ${formatStaffLabel(primaryStaff)}`
              : ticket.assigneeUserId
                ? 'Loading assignee…'
                : 'Currently unassigned'
          }
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            assign.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <Input
              label="Search staff by name, email or role"
              placeholder="Start typing…"
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
            />
            <label className="block">
              <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
                Department
              </span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value as DeptTag | 'all')}
                className="w-full sm:w-56 h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              >
                {DEPT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
              Primary assignee
            </span>
            <p className="text-xs text-muted mb-2">
              SLA counts against the primary. Select "— Unassign —" to clear.
            </p>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5">
              <label className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-muted cursor-pointer">
                <input
                  type="radio"
                  name="primary-assignee"
                  checked={primaryId === ''}
                  onChange={() => {
                    setPrimaryId('');
                  }}
                  className="accent-brand-orange"
                />
                <span className="italic text-muted">— Unassign —</span>
              </label>
              {filteredStaff.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted italic">No staff match.</p>
              ) : (
                filteredStaff.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-muted cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="primary-assignee"
                      checked={primaryId === u.id}
                      onChange={() => {
                        setPrimaryId(u.id);
                        setCoAssigneeIds((prev) => prev.filter((x) => x !== u.id));
                      }}
                      className="accent-brand-orange"
                    />
                    <span
                      aria-hidden
                      className="shrink-0 h-8 w-8 rounded-lg bg-navy-100 text-brand-navy font-bold text-xs grid place-items-center"
                    >
                      {initials(u.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-brand-navy truncate">{u.name}</p>
                      <p className="text-xs text-muted truncate">
                        {u.email} · {u.role}
                        {u.deptTag ? ` · ${u.deptTag.replace('_', ' ')}` : ''}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
              Also loop in (co-assignees)
            </span>
            <p className="text-xs text-muted mb-2">
              Co-assignees get every notification and can reply, but the SLA
              clock stays with the primary.
            </p>
            {coAssigneeStaff.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {coAssigneeStaff.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 text-xs rounded-full bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => toggleCoAssignee(u.id)}
                      className="hover:text-amber-950"
                      aria-label={`Remove ${u.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-40 overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5">
              {filteredStaff
                .filter((u) => u.id !== primaryId)
                .slice(0, 40)
                .map((u) => {
                  const checked = coAssigneeIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCoAssignee(u.id)}
                        className="accent-brand-orange"
                      />
                      <span className="font-semibold text-brand-navy">{u.name}</span>
                      <span className="text-xs text-muted">
                        {u.role}
                        {u.deptTag ? ` · ${u.deptTag.replace('_', ' ')}` : ''}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={assign.isPending}>
              Save assignment
            </Button>
          </div>
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
              {(['open','assigned','in_progress','resolved','closed'] as TicketState[]).map((s) => (
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
