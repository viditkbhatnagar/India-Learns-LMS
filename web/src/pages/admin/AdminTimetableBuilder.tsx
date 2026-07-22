import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BatchDto, CourseDto, UserPublicDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, Skeleton } from '../../components/ui/States.js';
import { batchesApi, coursesApi, timetableEntriesApi, usersApi } from '../../lib/endpoints.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SELECT_CLS =
  'w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed';

/** minutes-from-midnight ⇄ "HH:MM" (what <input type="time"> uses). */
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

interface Entry {
  id: string;
  courseId: string;
  facultyId: string;
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  room: string;
}

export function AdminTimetableBuilderPage() {
  const qc = useQueryClient();
  const batchesQ = useQuery({ queryKey: ['admin', 'batches'], queryFn: batchesApi.list });
  const [batchId, setBatchId] = useState('');

  // Courses + faculty for the dropdowns (loaded once a batch is chosen).
  const coursesQ = useQuery({
    queryKey: ['courses'],
    queryFn: () => coursesApi.list() as Promise<CourseDto[]>,
    enabled: !!batchId,
  });
  const facultyQ = useQuery({
    queryKey: ['users', 'faculty'],
    queryFn: () => usersApi.list({ role: 'faculty' }) as Promise<UserPublicDto[]>,
    enabled: !!batchId,
  });
  const entriesQ = useQuery({
    queryKey: ['admin', 'batch', batchId, 'timetable'],
    queryFn: () => batchesApi.timetable(batchId) as Promise<Entry[]>,
    enabled: !!batchId,
  });

  const batches = (batchesQ.data as BatchDto[] | undefined) ?? [];
  const selectedBatch = batches.find((b) => b.id === batchId);
  // Only courses in this batch's program can be timetabled for it.
  const coursesForProgram = useMemo(
    () => (coursesQ.data ?? []).filter((c) => c.programId === selectedBatch?.programId),
    [coursesQ.data, selectedBatch?.programId],
  );
  const faculty = facultyQ.data ?? [];
  const courseName = (id: string) => coursesForProgram.find((c) => c.id === id)?.name
    ?? (coursesQ.data ?? []).find((c) => c.id === id)?.name ?? 'Course';
  const facultyName = (id: string) => faculty.find((f) => f.id === id)?.name ?? 'Teacher';

  const [courseId, setCourseId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [weekday, setWeekday] = useState(1);
  const [startMinute, setStartMinute] = useState(540); // 09:00
  const [endMinute, setEndMinute] = useState(600); // 10:00
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
    onSuccess: () => {
      setCourseId('');
      setFacultyId('');
      setRoom('');
      qc.invalidateQueries({ queryKey: ['admin', 'batch', batchId, 'timetable'] });
    },
    onError: (e) => setError((e as Error).message),
  });

  function onBatchChange(value: string) {
    setBatchId(value);
    setCourseId('');
    setFacultyId('');
    setError(null);
  }

  const noCourses = !!batchId && coursesQ.isSuccess && coursesForProgram.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Timetable builder</h1>
        <p className="text-muted text-sm mt-1">Add weekly recurring classes to a batch's timetable.</p>
      </div>

      <Card>
        <label className="block max-w-sm">
          <span className="block text-sm font-medium text-brand-navy mb-1.5">Batch</span>
          <select value={batchId} onChange={(e) => onBatchChange(e.target.value)} className={SELECT_CLS}>
            <option value="">Select a batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {batchId && (
        <Card>
          <CardHeader title="Add a class" subtitle="Pick the course, teacher, day and time — no IDs needed." />
          {noCourses ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ This batch's program has no courses yet, so there's nothing to timetable. Import the
              curriculum for this program first, then come back.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!courseId || !facultyId) return setError('Please choose a course and a teacher.');
                if (endMinute <= startMinute) return setError('End time must be after the start time.');
                return create.mutate();
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <label className="block">
                <span className="block text-sm font-medium text-brand-navy mb-1.5">Course</span>
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={SELECT_CLS}>
                  <option value="">Select a course…</option>
                  {coursesForProgram.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-brand-navy mb-1.5">Teacher</span>
                <select
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className={SELECT_CLS}
                  disabled={faculty.length === 0}
                >
                  <option value="">
                    {faculty.length === 0 ? 'No faculty yet — create one first' : 'Select a teacher…'}
                  </option>
                  {faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-brand-navy mb-1.5">Day</span>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className={SELECT_CLS}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 2" />
              <Input
                label="Start time"
                type="time"
                value={minToHHMM(startMinute)}
                onChange={(e) => setStartMinute(hhmmToMin(e.target.value))}
              />
              <Input
                label="End time"
                type="time"
                value={minToHHMM(endMinute)}
                onChange={(e) => setEndMinute(hhmmToMin(e.target.value))}
              />
              <div className="sm:col-span-2 flex justify-between items-center">
                {error && <p className="text-danger text-sm">{error}</p>}
                <Button type="submit" loading={create.isPending} className="ml-auto">
                  Add class
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {batchId && (
        <Card>
          <CardHeader title="Weekly schedule" />
          {entriesQ.isLoading && <Skeleton lines={3} />}
          {entriesQ.data &&
            (entriesQ.data.length === 0 ? (
              <EmptyState title="No classes yet" message="Add the first class above." />
            ) : (
              <ul className="divide-y divide-black/5">
                {entriesQ.data.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    batchId={batchId}
                    courseName={courseName(entry.courseId)}
                    facultyName={facultyName(entry.facultyId)}
                  />
                ))}
              </ul>
            ))}
        </Card>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  batchId,
  courseName,
  facultyName,
}: {
  entry: Entry;
  batchId: string;
  courseName: string;
  facultyName: string;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => timetableEntriesApi.deleteEntry(entry.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'batch', batchId, 'timetable'] }),
  });
  return (
    <li className="py-2.5 flex items-center justify-between gap-4 text-sm">
      <span className="min-w-0">
        <span className="font-semibold text-brand-navy">{WEEKDAYS[entry.dayOfWeek] ?? 'Day'}</span>
        {' · '}
        {minToHHMM(entry.startTimeMinutes)}–{minToHHMM(entry.endTimeMinutes)}
        {' · '}
        {courseName}
        {' · '}
        {facultyName}
        {' · '}
        room {entry.room || 'TBA'}
      </span>
      <Button
        size="sm"
        variant="ghost"
        loading={del.isPending}
        onClick={() => {
          if (window.confirm('Delete this class?')) del.mutate();
        }}
      >
        Delete
      </Button>
    </li>
  );
}
