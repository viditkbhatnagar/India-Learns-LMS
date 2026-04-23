import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, Skeleton } from '../../components/ui/States.js';
import { batchesApi, timetableEntriesApi } from '../../lib/endpoints.js';

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
