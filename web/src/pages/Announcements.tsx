import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.js';
import { api } from '../lib/api.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Input, TextArea } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../components/ui/States.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { programsApi, batchesApi } from '../lib/endpoints.js';

// M10j — Announcements page (LMS_Requirements §2 "Announcement section
// from admin/faculty"). Two cards on one screen:
//   1. Compose form (admin → global/program/batch; faculty → batch they teach)
//   2. Feed of recent announcements visible to the current user

interface AnnouncementItem {
  id: string;
  scope: 'course' | 'batch' | 'program' | 'global';
  scopeLabel: string;
  subject: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

interface BatchListItem {
  id: string;
  name: string;
  programId: string;
}

const SCOPE_TONES: Record<AnnouncementItem['scope'], 'success' | 'info' | 'accent' | 'neutral'> = {
  global: 'success',
  program: 'info',
  batch: 'accent',
  course: 'neutral',
};

export function AnnouncementsPage() {
  const me = useAuthStore((s) => s.user)!;
  const canCompose = ['admin', 'superadmin', 'faculty'].includes(me.role);
  const feedQ = useQuery({
    queryKey: ['me', 'announcements'],
    queryFn: async () => {
      const res = await api.get<{ data: { items: AnnouncementItem[] } }>('/me/announcements');
      return res.data.data.items;
    },
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Communication"
        title="Announcements"
        subtitle={
          canCompose
            ? 'Broadcast updates to a batch, programme, or the whole school. Recent posts visible to you are listed below.'
            : 'Recent announcements visible to you.'
        }
      />

      {canCompose && <ComposeCard role={me.role} />}

      <Card>
        <CardHeader title="Recent" subtitle={`${feedQ.data?.length ?? 0} announcements`} />
        {feedQ.isLoading && <Skeleton lines={3} />}
        {feedQ.isError && (
          <ErrorAlert message={(feedQ.error as Error).message} onRetry={() => feedQ.refetch()} />
        )}
        {feedQ.data && feedQ.data.length === 0 && (
          <EmptyState title="No announcements yet" message="When admin or faculty broadcasts an update, it appears here." />
        )}
        {feedQ.data && feedQ.data.length > 0 && (
          <ul className="divide-y divide-black/5">
            {feedQ.data.map((a) => (
              <li key={a.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">{a.subject}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {a.authorName ?? 'Staff'} · {new Date(a.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <Badge tone={SCOPE_TONES[a.scope]} dot>
                    {a.scopeLabel}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink/80 whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ComposeCard({ role }: { role: string }) {
  const qc = useQueryClient();
  const canScopeGlobal = ['admin', 'superadmin'].includes(role);
  const canScopeProgram = ['admin', 'superadmin'].includes(role);
  // Faculty + admin + superadmin can scope to a batch.

  type Scope = 'global' | 'program' | 'batch';
  const [scope, setScope] = useState<Scope>(canScopeGlobal ? 'global' : 'batch');
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const batchesQ = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await batchesApi.list()) as BatchListItem[],
  });

  useEffect(() => {
    setProgramId('');
    setBatchId('');
  }, [scope]);

  const filteredBatches = (batchesQ.data ?? []).filter(
    (b) => !programId || b.programId === programId,
  );

  const send = useMutation({
    mutationFn: () =>
      api.post('/announcements', {
        scope,
        programId: scope === 'program' ? programId : undefined,
        batchId: scope === 'batch' ? batchId : undefined,
        subject,
        body,
      }),
    onSuccess: () => {
      setMsg({ kind: 'ok', text: 'Announcement sent.' });
      setSubject('');
      setBody('');
      qc.invalidateQueries({ queryKey: ['me', 'announcements'] });
    },
    onError: (err) =>
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Failed to send announcement.',
      }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (scope === 'program' && !programId) {
      setMsg({ kind: 'err', text: 'Pick a programme.' });
      return;
    }
    if (scope === 'batch' && !batchId) {
      setMsg({ kind: 'err', text: 'Pick a batch.' });
      return;
    }
    send.mutate();
  }

  return (
    <Card>
      <CardHeader
        title="Compose announcement"
        subtitle="Reaches everyone in the chosen scope by in-app notification + email."
      />
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">Scope</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {canScopeGlobal && <option value="global">Global (everyone)</option>}
              {canScopeProgram && <option value="program">Programme</option>}
              <option value="batch">Batch</option>
            </select>
          </label>
          {scope === 'program' && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs uppercase tracking-wider text-muted font-bold">
                Programme
              </span>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
              >
                <option value="">Pick…</option>
                {(programsQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === 'batch' && (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">
                  Programme (optional filter)
                </span>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    setBatchId('');
                  }}
                  className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
                >
                  <option value="">All programmes</option>
                  {(programsQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">Batch</span>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
                >
                  <option value="">Pick…</option>
                  {filteredBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={240}
          required
        />
        <TextArea
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={4000}
          required
        />
        {msg && (
          <div
            role={msg.kind === 'ok' ? 'status' : 'alert'}
            className={`rounded-xl p-3 text-sm ${
              msg.kind === 'ok'
                ? 'bg-emerald-50 border border-emerald-200 text-success'
                : 'bg-red-50 border border-danger/30 text-danger'
            }`}
          >
            {msg.text}
          </div>
        )}
        <Button type="submit" loading={send.isPending}>
          Send announcement
        </Button>
      </form>
    </Card>
  );
}
