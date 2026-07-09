import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EntranceCandidateRowDto,
  EntranceCandidateStatus,
  EntranceExamAdminDto,
  EntranceExamState,
} from 'india-learns-shared-types';
import { entranceAdminApi } from '../../lib/endpoints.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';

const IST_OFFSET = '+05:30';

/** UTC ISO → `YYYY-MM-DDTHH:mm` in IST for a datetime-local input. */
function isoToInputIST(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** datetime-local value (interpreted as IST) → UTC ISO string. */
function inputISTtoIso(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00${IST_OFFSET}`).toISOString();
}

const STATUS_TONE: Record<EntranceCandidateStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  not_started: 'neutral',
  in_progress: 'info',
  submitted: 'warning',
  graded: 'success',
};

const STATUS_LABEL: Record<EntranceCandidateStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-2xl font-bold text-brand-navy tabular-nums">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function WindowControls({ exam }: { exam: EntranceExamAdminDto }) {
  const qc = useQueryClient();
  const [state, setState] = useState<EntranceExamState>(exam.state);
  const [opensAt, setOpensAt] = useState(isoToInputIST(exam.opensAt));
  const [closesAt, setClosesAt] = useState(isoToInputIST(exam.closesAt));
  const [duration, setDuration] = useState(exam.durationMinutes);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setState(exam.state);
    setOpensAt(isoToInputIST(exam.opensAt));
    setClosesAt(isoToInputIST(exam.closesAt));
    setDuration(exam.durationMinutes);
  }, [exam]);

  const mutation = useMutation({
    mutationFn: () =>
      entranceAdminApi.updateExam(exam.id, {
        state,
        opensAt: inputISTtoIso(opensAt),
        closesAt: inputISTtoIso(closesAt),
        durationMinutes: duration,
      }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['entrance-admin', 'exams'] });
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  const inputCls =
    'w-full rounded-xl border border-black/10 bg-white p-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all';

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-navy">Exam window</h2>
        <Badge tone={state === 'live' ? 'success' : state === 'closed' ? 'danger' : 'neutral'}>
          {state}
        </Badge>
      </div>
      <p className="text-xs text-muted mt-1">
        All times are IST. Candidates can only log in and start while the exam is
        <span className="font-semibold"> live</span> and inside the window.
      </p>
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold text-ink/70 mb-1">Status</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as EntranceExamState)}
            className={inputCls}
          >
            <option value="draft">Draft (hidden)</option>
            <option value="live">Live (open)</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-ink/70 mb-1">
            Duration per attempt (minutes)
          </span>
          <input
            type="number"
            min={1}
            max={600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-ink/70 mb-1">Opens at (IST)</span>
          <input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-ink/70 mb-1">Closes at (IST)</span>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Save window
        </Button>
        {saved && <span className="text-sm text-success font-medium">Saved</span>}
        {mutation.isError && (
          <span className="text-sm text-danger">{(mutation.error as Error).message}</span>
        )}
      </div>
    </Card>
  );
}

function CandidatesTable({
  examId,
  totalMarks,
}: {
  examId: string;
  totalMarks: number;
}) {
  const query = useQuery({
    queryKey: ['entrance-admin', 'candidates', examId],
    queryFn: () => entranceAdminApi.listCandidates(examId),
    refetchInterval: 15_000,
  });

  const rows = useMemo<EntranceCandidateRowDto[]>(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => {
    const c = { total: rows.length, submitted: 0, inProgress: 0, notStarted: 0, pending: 0 };
    rows.forEach((r) => {
      if (r.status === 'submitted' || r.status === 'graded') c.submitted += 1;
      else if (r.status === 'in_progress') c.inProgress += 1;
      else c.notStarted += 1;
      if (r.pendingManualGrade) c.pending += 1;
    });
    return c;
  }, [rows]);

  if (query.isLoading) return <Skeleton lines={8} />;
  if (query.isError) {
    return (
      <ErrorAlert
        message={query.error instanceof Error ? query.error.message : 'Failed to load candidates.'}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No candidates yet"
        message="Run `npm run seed:entrance -w api` to create the candidate logins."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Candidates" value={counts.total} />
        <Stat label="Submitted" value={counts.submitted} />
        <Stat label="In progress" value={counts.inProgress} />
        <Stat label="Not started" value={counts.notStarted} />
        <Stat label="Needs grading" value={counts.pending} />
      </div>

      <p className="text-sm text-muted">
        Scores shown are each candidate&rsquo;s <span className="font-semibold text-brand-navy">best attempt</span>,
        out of <span className="font-semibold text-brand-navy">{totalMarks}</span> marks.
        The written answer is graded manually — a candidate&rsquo;s full total
        appears once you score it. Open a candidate to see all their attempts.
      </p>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-black/10">
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Phone</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right">Attempts</th>
                <th className="p-3 font-semibold text-right">Auto</th>
                <th className="p-3 font-semibold text-right">Written</th>
                <th className="p-3 font-semibold text-right">Total / {totalMarks}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r: EntranceCandidateRowDto) => (
                <tr key={r.id} className="border-b border-black/5 hover:bg-surface-muted">
                  <td className="p-3 font-medium text-brand-navy">{r.name}</td>
                  <td className="p-3 text-ink/70 tabular-nums">{r.phone}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.pendingManualGrade && <Badge tone="accent">Needs grading</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.attemptsUsed}/{r.maxAttempts}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.autoScoreMarks ?? '—'}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.manualScoreMarks ?? '—'}
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold">
                    {r.totalScoreMarks !== null ? (
                      <span className="text-success">
                        {r.totalScoreMarks}
                        <span className="text-muted font-normal">/{totalMarks}</span>
                      </span>
                    ) : (
                      <span className="text-muted font-normal">—/{totalMarks}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/admin/entrance/candidates/${r.id}`}
                      className="text-sm font-medium text-brand-navy hover:text-brand-orange"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminEntranceExamPage() {
  const query = useQuery({
    queryKey: ['entrance-admin', 'exams'],
    queryFn: () => entranceAdminApi.listExams(),
  });

  if (query.isLoading) return <Skeleton lines={10} />;
  if (query.isError) {
    return (
      <ErrorAlert
        message={query.error instanceof Error ? query.error.message : 'Failed to load.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const exam = query.data?.[0];
  if (!exam) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Entrance exam" title="Entrance Examination" />
        <EmptyState
          title="No entrance exam found"
          message="Run `npm run seed:entrance -w api` to create the exam and candidate logins."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Entrance exam"
        title={exam.title}
        subtitle={`${exam.questions.length} questions · ${exam.totalMarks} marks · ${exam.durationMinutes} minutes`}
      />
      <WindowControls exam={exam} />
      <CandidatesTable examId={exam.id} totalMarks={exam.totalMarks} />
    </div>
  );
}
