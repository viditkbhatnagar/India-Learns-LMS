import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { timetableApi } from '../../lib/endpoints.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDate } from '../../lib/format.js';

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function StudentTimetable() {
  const [week, setWeek] = useState(() => isoWeekString(new Date()));
  const query = useQuery({
    queryKey: ['me', 'timetable', week],
    queryFn: () => timetableApi.mine({ week }),
  });

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  const byDay = new Map<string, typeof items>();
  items.forEach((occ) => {
    const key = occ.date;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(occ);
  });
  const sortedDays = Array.from(byDay.keys()).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">My timetable</h1>
        <input
          type="week"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-black/10 text-sm"
        />
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState title="No classes this week" message="Either it's a holiday week or the timetable hasn't been published yet." />
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedDays.map((day) => (
            <Card key={day}>
              <p className="text-sm font-semibold text-brand-navy">{formatIstDate(day, 'EEEE, d MMM yyyy')}</p>
              <ul className="mt-2 divide-y divide-black/5">
                {byDay.get(day)!.map((occ) => (
                  <li key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt} className="py-2">
                    <div className="flex items-baseline justify-between">
                      <p className="font-medium">{occ.courseName}</p>
                      <p className="text-sm text-muted mono">
                        {formatInTimeZone(new Date(occ.startAt), 'Asia/Kolkata', 'HH:mm')}–
                        {formatInTimeZone(new Date(occ.endAt), 'Asia/Kolkata', 'HH:mm')}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {occ.facultyName} · {occ.room || 'TBA'}
                      {occ.isOverride && ' · rescheduled'}
                      {occ.isAdded && ' · extra class'}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
