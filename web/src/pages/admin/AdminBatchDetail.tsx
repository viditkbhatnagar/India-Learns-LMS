import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { batchesApi } from '../../lib/endpoints.js';
import { formatIstDate } from '../../lib/format.js';

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
