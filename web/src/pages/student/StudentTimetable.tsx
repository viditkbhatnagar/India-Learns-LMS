import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { timetableApi } from '../../lib/endpoints.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
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

  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const items = query.data ?? [];

  const byDay = new Map<string, typeof items>();
  items.forEach((occ) => {
    const key = occ.date;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(occ);
  });
  const sortedDays = Array.from(byDay.keys()).sort();

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
            Schedule
          </p>
          <h1 className="text-display-sm text-brand-navy">Timetable</h1>
          <p className="mt-2 text-muted">
            {items.length} class{items.length === 1 ? '' : 'es'} this week
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-muted font-semibold mb-1">Week</span>
          <input
            type="week"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="h-11 px-3.5 rounded-xl border border-black/10 bg-white text-sm hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
          />
        </label>
      </header>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No classes this week"
            message="Either it's a holiday week or the timetable hasn't been published yet."
          />
        </Card>
      ) : (
        <div className="space-y-4 animate-fade-in-up">
          {sortedDays.map((day) => (
            <Card key={day} accent="orange">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <p className="text-sm font-bold text-brand-navy tracking-tight">
                  {formatIstDate(day, 'EEEE, d MMM yyyy')}
                </p>
                <Badge tone="neutral" size="sm">
                  {byDay.get(day)!.length} class{byDay.get(day)!.length === 1 ? '' : 'es'}
                </Badge>
              </div>
              <ul className="space-y-2">
                {byDay.get(day)!.map((occ) => (
                  <li
                    key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt}
                    className="flex items-start gap-4 rounded-xl bg-surface-muted p-4"
                  >
                    <div
                      aria-hidden
                      className="shrink-0 rounded-xl bg-white shadow-elev-1 px-3 py-2 text-center min-w-[72px]"
                    >
                      <p className="text-brand-navy font-bold text-sm tabular-nums">
                        {formatInTimeZone(new Date(occ.startAt), 'Asia/Kolkata', 'HH:mm')}
                      </p>
                      <p className="text-[10px] text-muted tabular-nums mt-0.5">
                        {formatInTimeZone(new Date(occ.endAt), 'Asia/Kolkata', 'HH:mm')}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-brand-navy truncate">{occ.courseName}</p>
                      <p className="text-xs text-muted mt-1">
                        {occ.facultyName} · {occ.room || 'Room TBA'}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {occ.isOverride && <Badge tone="warning" size="sm">rescheduled</Badge>}
                        {occ.isAdded && <Badge tone="accent" size="sm">extra class</Badge>}
                      </div>
                    </div>
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
