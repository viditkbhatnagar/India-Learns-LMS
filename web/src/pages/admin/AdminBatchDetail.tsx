import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BatchDto } from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { batchesApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';
import { formatIstDate } from '../../lib/format.js';

export function AdminBatchDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const batchQ = useQuery({
    queryKey: ['admin', 'batch', id],
    queryFn: () => batchesApi.get(id) as Promise<BatchDto>,
    enabled: !!id,
  });
  const timetableQ = useQuery({
    queryKey: ['admin', 'batch', id, 'timetable'],
    queryFn: () => batchesApi.timetable(id),
    enabled: !!id,
  });

  const [openForApplications, setOpenForApplications] = useState(false);
  const [seatsRemaining, setSeatsRemaining] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!batchQ.data) return;
    setOpenForApplications(Boolean(batchQ.data.openForApplications));
    setSeatsRemaining(String(batchQ.data.seatsRemaining ?? batchQ.data.capacity ?? 30));
  }, [batchQ.data]);

  const save = useMutation({
    mutationFn: () =>
      batchesApi.update(id, {
        openForApplications,
        seatsRemaining: Math.max(0, Number(seatsRemaining) || 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'batch', id] });
      setSavedAt(new Date().toLocaleTimeString());
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Save failed.');
    },
  });

  if (batchQ.isLoading) return <Skeleton lines={4} />;
  if (batchQ.isError || !batchQ.data) {
    return <ErrorAlert message={(batchQ.error as Error)?.message ?? 'Batch not found.'} />;
  }
  const b = batchQ.data;

  return (
    <div className="space-y-4">
      <Link to="/admin/batches" className="text-sm text-brand-orange hover:underline">
        ← Back
      </Link>
      <h1 className="text-display-sm text-brand-navy tracking-tight">Batch · {b.name}</h1>

      <Card className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Status" value={b.status} />
        <Row label="Capacity" value={String(b.capacity)} />
        <Row label="Starts" value={formatIstDate(b.startDate)} />
        <Row label="Ends" value={formatIstDate(b.endDate)} />
        <Row label="Open for applications" value={b.openForApplications ? 'yes' : 'no'} />
        <Row label="Seats remaining" value={String(b.seatsRemaining ?? '—')} />
      </Card>

      <Card accent="orange">
        <CardHeader
          title="Admissions config"
          subtitle="Controls whether this batch appears in the public /apply cohort feed and the live seat count for admit-time gating."
        />
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={openForApplications}
              onChange={(e) => setOpenForApplications(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-semibold text-brand-navy">Open for applications</span>
            {openForApplications ? (
              <Badge tone="success" dot>Visible on /apply</Badge>
            ) : (
              <Badge tone="neutral" dot>Hidden</Badge>
            )}
          </label>
          <div className="max-w-xs">
            <Input
              type="number"
              min="0"
              max={String(b.capacity)}
              label="Seats remaining"
              value={seatsRemaining}
              onChange={(e) => setSeatsRemaining(e.target.value)}
              hint={`Cannot exceed capacity (${b.capacity}). Auto-decrements when an applicant accepts an offer.`}
            />
          </div>
          {error && (
            <div role="alert" className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {savedAt ? `Last saved at ${savedAt}` : 'Unsaved changes after first edit.'}
            </span>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save admissions config
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Timetable"
          action={
            <Link to="/admin/timetable" className="text-sm text-brand-orange hover:underline">
              Edit timetable →
            </Link>
          }
        />
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
