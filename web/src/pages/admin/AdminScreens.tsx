import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EnrollmentDto,
  HolidayDto,
  TicketCommentDto,
  TicketDto,
  TicketState,
} from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import {
  adminEnrollmentsApi,
  auditLogApi,
  batchesApi,
  enrollmentsApi,
  feesApi,
  holidaysApi,
  holidaysApiAdmin,
  programsApi,
  ticketsApi,
  timetableEntriesApi,
} from '../../lib/endpoints.js';
import { formatIstDate, formatIstDateTime } from '../../lib/format.js';

// ---------- /admin/batches ----------

export function AdminBatchesPage() {
  const qc = useQueryClient();
  const batchesQ = useQuery({ queryKey: ['admin', 'batches'], queryFn: batchesApi.list });
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });

  const [name, setName] = useState('');
  const [programId, setProgramId] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      batchesApi.create({ name, programId, capacity, startDate, endDate: endDate || startDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'batches'] });
      setName('');
      setEndDate('');
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Batches</h1>
        <p className="text-muted text-sm mt-1">Each batch caps at 30 students by default.</p>
      </div>

      <Card>
        <CardHeader title="Create batch" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name || !programId) return setError('Name and program required.');
            create.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Program</span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(programsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Capacity"
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div className="sm:col-span-2 flex justify-between items-center">
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" loading={create.isPending} className="ml-auto">
              Create
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Existing batches" />
        {batchesQ.isLoading && <Skeleton lines={3} />}
        {batchesQ.isError && <ErrorAlert message={(batchesQ.error as Error).message} />}
        {batchesQ.data &&
          (batchesQ.data.length === 0 ? (
            <EmptyState title="No batches yet" />
          ) : (
            <ul className="divide-y divide-black/5">
              {(batchesQ.data as Array<Record<string, unknown>>).map((b) => (
                <li key={String(b.id)} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/admin/batches/${String(b.id)}`} className="font-medium text-brand-navy hover:underline">
                      {String(b.name)}
                    </Link>
                    <p className="text-xs text-muted">
                      capacity {String(b.capacity)} · {String(b.status)}
                    </p>
                  </div>
                  <Badge tone={b.status === 'active' ? 'success' : 'neutral'}>{String(b.status)}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /admin/batches/:id ----------

export function AdminBatchDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const batchQ = useQuery({
    queryKey: ['admin', 'batch', id],
    queryFn: () => batchesApi.get(id),
    enabled: !!id,
  });
  const timetableQ = useQuery({
    queryKey: ['admin', 'batch', id, 'timetable'],
    queryFn: () => batchesApi.timetable(id),
    enabled: !!id,
  });
  if (batchQ.isLoading) return <Skeleton lines={4} />;
  if (batchQ.isError) return <ErrorAlert message={(batchQ.error as Error).message} />;
  const b = (batchQ.data ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-4">
      <Link to="/admin/batches" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <h1 className="text-display-sm text-brand-navy tracking-tight">Batch · {String(b.name)}</h1>
      <Card className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Status" value={String(b.status)} />
        <Row label="Capacity" value={String(b.capacity)} />
        <Row label="Starts" value={formatIstDate(String(b.startDate))} />
        <Row label="Ends" value={formatIstDate(String(b.endDate))} />
      </Card>
      <Card>
        <CardHeader title="Timetable" action={
          <Link to="/admin/timetable" className="text-sm text-brand-orange hover:underline">Edit timetable →</Link>
        } />
        {timetableQ.isLoading && <Skeleton lines={3} />}
        {timetableQ.data &&
          ((timetableQ.data as unknown[]).length === 0 ? (
            <EmptyState title="No timetable entries" />
          ) : (
            <ul className="divide-y divide-black/5">
              {(timetableQ.data as Array<Record<string, unknown>>).map((e) => (
                <li key={String(e.id)} className="py-2 text-sm">
                  Day {String(e.dayOfWeek)} · {String(e.startTimeMinutes)}–{String(e.endTimeMinutes)} min · room {String(e.room) || 'TBA'}
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className="text-brand-navy font-medium">{value}</p>
    </div>
  );
}

// ---------- /admin/timetable (builder) ----------

export function AdminTimetableBuilderPage() {
  const qc = useQueryClient();
  const batchesQ = useQuery({ queryKey: ['admin', 'batches'], queryFn: batchesApi.list });
  const [batchId, setBatchId] = useState('');
  const entriesQ = useQuery({
    queryKey: ['admin', 'batch', batchId, 'timetable'],
    queryFn: () => batchesApi.timetable(batchId),
    enabled: !!batchId,
  });

  const [courseId, setCourseId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [startMinute, setStartMinute] = useState(540);
  const [endMinute, setEndMinute] = useState(600);
  const [room, setRoom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      timetableEntriesApi.createEntry(batchId, {
        courseId,
        facultyId,
        weekday,
        startMinute,
        endMinute,
        room,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'batch', batchId, 'timetable'] }),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Timetable builder</h1>
        <p className="text-muted text-sm mt-1">Add weekly recurring entries to a batch's timetable.</p>
      </div>
      <Card>
        <label className="block max-w-sm">
          <span className="block text-sm font-medium text-brand-navy mb-1.5">Batch</span>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
          >
            <option value="">Select…</option>
            {(batchesQ.data as Array<Record<string, unknown>> ?? []).map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {String(b.name)}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {batchId && (
        <Card>
          <CardHeader title="Add entry" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!courseId || !facultyId) return setError('Course and faculty required.');
              if (endMinute <= startMinute) return setError('End must be after start.');
              create.mutate();
            }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Input label="Course ID" value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
            <Input label="Faculty ID" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required />
            <label className="block">
              <span className="block text-sm font-medium text-brand-navy mb-1.5">Weekday</span>
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              >
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </label>
            <Input
              label="Start (minutes from midnight)"
              type="number"
              value={startMinute}
              onChange={(e) => setStartMinute(Number(e.target.value))}
              hint="540 = 09:00"
            />
            <Input
              label="End"
              type="number"
              value={endMinute}
              onChange={(e) => setEndMinute(Number(e.target.value))}
            />
            <Input label="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
            <div className="sm:col-span-3 flex justify-between items-center">
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" loading={create.isPending} className="ml-auto">
                Add entry
              </Button>
            </div>
          </form>
        </Card>
      )}

      {batchId && (
        <Card>
          <CardHeader title="Existing entries" />
          {entriesQ.isLoading && <Skeleton lines={3} />}
          {entriesQ.data &&
            ((entriesQ.data as unknown[]).length === 0 ? (
              <EmptyState title="No entries yet" />
            ) : (
              <ul className="divide-y divide-black/5">
                {(entriesQ.data as Array<Record<string, unknown>>).map((e) => (
                  <EntryRow key={String(e.id)} entry={e} batchId={batchId} />
                ))}
              </ul>
            ))}
        </Card>
      )}
    </div>
  );
}

function EntryRow({ entry, batchId }: { entry: Record<string, unknown>; batchId: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => timetableEntriesApi.deleteEntry(String(entry.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'batch', batchId, 'timetable'] }),
  });
  return (
    <li className="py-2 flex items-center justify-between text-sm">
      <span>
        Day {String(entry.dayOfWeek)} · {String(entry.startTimeMinutes)}–{String(entry.endTimeMinutes)} min ·{' '}
        room {String(entry.room) || 'TBA'}
      </span>
      <Button
        size="sm"
        variant="ghost"
        loading={del.isPending}
        onClick={() => {
          if (confirm('Delete this entry?')) del.mutate();
        }}
      >
        Delete
      </Button>
    </li>
  );
}

// ---------- /admin/enrollments ----------

export function AdminEnrollmentsPage() {
  const q = useQuery({ queryKey: ['admin', 'enrollments'], queryFn: () => adminEnrollmentsApi.list() });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Enrolments</h1>
        <p className="text-muted text-sm mt-1">All student–course relationships across batches.</p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No enrolments yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">Student</th>
                  <th>Course</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th className="text-right">Valid to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {q.data.map((e: EnrollmentDto) => (
                  <tr key={e.id}>
                    <td className="py-2 font-mono text-xs">{e.studentId.slice(-8)}</td>
                    <td className="font-mono text-xs">{e.courseId.slice(-8)}</td>
                    <td className="font-mono text-xs">{e.batchId.slice(-8)}</td>
                    <td>
                      <Badge tone={e.accessState === 'active' ? 'success' : e.accessState === 'suspended' ? 'danger' : 'warning'}>
                        {e.accessState}
                      </Badge>
                    </td>
                    <td className="text-right">{formatIstDate(e.validTo)}</td>
                    <td className="text-right">
                      <Link to={`/admin/enrollments/${e.id}`} className="text-brand-orange hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Card>
    </div>
  );
}

// ---------- /admin/enrollments/:id ----------

export function AdminEnrollmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => enrollmentsApi.get(id),
    enabled: !!id,
  });
  const issue = useMutation({
    mutationFn: () => enrollmentsApi.issueCertificate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollment', id] }),
  });
  const generateFees = useMutation({
    mutationFn: () => adminEnrollmentsApi.generateFees(id),
  });
  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} />;
  if (!q.data) return null;
  const e = q.data;
  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/admin/enrollments" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <h1 className="text-display-sm text-brand-navy tracking-tight">Enrolment {e.id.slice(-8)}</h1>
      <Card className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Student" value={e.studentId} />
        <Row label="Course" value={e.courseId} />
        <Row label="Status" value={e.status} />
        <Row label="Access" value={e.accessState} />
        <Row label="Completed" value={e.completed ? 'Yes' : 'No'} />
        <Row label="Valid to" value={formatIstDate(e.validTo)} />
      </Card>
      <Card>
        <CardHeader title="Certificate" />
        {e.certificateUrl ? (
          <p className="text-sm">
            Issued{' '}
            {e.certificateIssuedAt && formatIstDateTime(e.certificateIssuedAt)} ·{' '}
            <a className="text-brand-orange hover:underline" href={e.certificateUrl} target="_blank" rel="noreferrer">
              View certificate
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted">No certificate yet.</p>
        )}
        <Button
          className="mt-3"
          loading={issue.isPending}
          onClick={() => issue.mutate()}
          disabled={!e.completed}
        >
          {e.certificateUrl ? 'Reissue certificate' : 'Issue certificate'}
        </Button>
        {!e.completed && (
          <p className="text-xs text-muted mt-2">
            Enrolment must be completed (course done + exam passed) before a certificate can be issued.
          </p>
        )}
        {issue.isError && <ErrorAlert message={(issue.error as Error).message} />}
      </Card>
      <Card>
        <CardHeader title="Fees" />
        <Button variant="secondary" loading={generateFees.isPending} onClick={() => generateFees.mutate()}>
          Generate / refresh invoices
        </Button>
        {generateFees.isError && <ErrorAlert message={(generateFees.error as Error).message} />}
        {generateFees.data && (
          <p className="text-sm mt-2 text-success">
            {generateFees.data.length} invoice{generateFees.data.length === 1 ? '' : 's'} ready.
          </p>
        )}
      </Card>
    </div>
  );
}

// ---------- /admin/audit-logs ----------

export function AdminAuditLogsPage() {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'audit-logs', actorId, action],
    queryFn: () => auditLogApi.list({ actorId: actorId || undefined, action: action || undefined, limit: 200 }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Audit log</h1>
        <p className="text-muted text-sm mt-1">Every staff write — who did what, when.</p>
      </div>
      <Card className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="Actor ID" value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="user _id" />
        <Input label="Action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. payment.recorded" />
        <div className="flex items-end">
          <Button variant="secondary" onClick={() => q.refetch()}>
            Apply
          </Button>
        </div>
      </Card>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No matching log entries" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2">When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {(q.data as Array<Record<string, unknown>>).map((row, i) => (
                  <tr key={i}>
                    <td className="py-2">{formatIstDateTime(String(row.at ?? row.createdAt))}</td>
                    <td className="font-mono text-xs">{String(row.actorUserId ?? row.actorId ?? '')}</td>
                    <td>{String(row.action)}</td>
                    <td className="font-mono text-xs">{String(row.targetId ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </Card>
    </div>
  );
}

// ---------- /admin/fee-structures ----------

export function AdminFeeStructuresPage() {
  const q = useQuery({ queryKey: ['admin', 'fee-structures'], queryFn: feesApi.feeStructures });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Fee structures</h1>
        <p className="text-muted text-sm mt-1">
          Templates that drive invoice generation per program. Read-only browser; create via API.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState
              title="No fee structures yet"
              message="Use POST /v1/fee-structures to create one (TRD §4.6)."
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {(q.data as Array<Record<string, unknown>>).map((s) => (
                <li key={String(s.id)} className="py-3">
                  <p className="font-medium text-brand-navy">{String(s.name)}</p>
                  <p className="text-xs text-muted">
                    program {String(s.programId)} · {(s.components as unknown[])?.length ?? 0} components
                  </p>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /admin/tickets/:ticketId ----------

export function AdminTicketDetailPage() {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
    enabled: !!ticketId,
  });
  const [comment, setComment] = useState('');
  const [transitionTo, setTransitionTo] = useState<TicketState>('assigned');
  const [transitionNote, setTransitionNote] = useState('');
  const addComment = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, comment),
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
        <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
      </Card>
      <Card>
        <CardHeader title="Conversation" />
        {comments.length === 0 ? (
          <EmptyState title="No comments yet" />
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="border-l-4 border-brand-orange/40 pl-3">
                <p className="text-xs text-muted">
                  {c.authorUserId.slice(-6)} · {formatIstDateTime(c.createdAt)} · {c.visibility}
                </p>
                <p className="text-sm whitespace-pre-wrap mt-1">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) addComment.mutate();
          }}
          className="mt-4 space-y-2"
        >
          <TextArea
            label="Add a public comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button type="submit" loading={addComment.isPending} disabled={!comment.trim()}>
            Post comment
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

// ---------- /admin/tickets/sla-breaches ----------

export function AdminSlaBreachesPage() {
  const q = useQuery({
    queryKey: ['admin', 'tickets', 'sla-breaches'],
    queryFn: () => ticketsApi.listAdmin({ slaBreached: 'any' }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">SLA breaches</h1>
        <p className="text-muted text-sm mt-1">
          Tickets that missed the 24h ack or 5d (15bd for complaints) resolve target.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No SLA breaches in scope" message="Excellent." />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/admin/tickets/${t.id}`} className="font-medium text-brand-navy hover:underline">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted">
                      <span className="font-mono">{t.code}</span> · {t.category} · since{' '}
                      {formatIstDateTime(t.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {t.slaAckBreached && <Badge tone="danger">ack</Badge>}
                    {t.slaResolveBreached && <Badge tone="danger">resolve</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /admin/holidays ----------

export function AdminHolidaysPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['holidays'], queryFn: holidaysApi.list });
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => holidaysApiAdmin.create({ date, name }),
    onSuccess: () => {
      setDate('');
      setName('');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => holidaysApiAdmin.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Holidays</h1>
        <p className="text-muted text-sm mt-1">
          Public holidays mute timetable + fee notifications and adjust SLA business-day clocks.
        </p>
      </div>
      <Card>
        <CardHeader title="Add holiday" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!date || !name) return setError('Date and name required.');
            create.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex items-end">
            <Button type="submit" loading={create.isPending}>Add</Button>
          </div>
          {error && <p className="text-danger text-sm sm:col-span-3">{error}</p>}
        </form>
      </Card>
      <Card>
        <CardHeader title="Existing holidays" />
        {q.isLoading && <Skeleton lines={3} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No holidays" />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((h: HolidayDto) => (
                <li key={h.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-navy">{h.name}</p>
                    <p className="text-xs text-muted">{formatIstDate(h.date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={del.isPending}
                    onClick={() => {
                      if (confirm('Remove this holiday?')) del.mutate(h.id);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// Re-export so App.tsx can import a single barrel.
export type {};
