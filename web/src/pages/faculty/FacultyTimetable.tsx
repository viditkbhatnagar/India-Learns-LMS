import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TimetableOccurrenceDto } from 'india-learns-shared-types';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { timetableApi } from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function FacultyTimetablePage() {
  const [week, setWeek] = useState(() => isoWeekString(new Date()));
  const q = useQuery({
    queryKey: ['faculty', 'timetable', week],
    queryFn: () => timetableApi.mine({ week }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">My timetable</h1>
          <p className="text-muted text-sm mt-1">Read-only view of your assigned classes.</p>
        </div>
        <Input
          type="week"
          label="Week"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="w-44"
        />
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No classes this week" />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((occ: TimetableOccurrenceDto) => (
                <li key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-brand-navy">{occ.courseName}</p>
                    <p className="text-xs text-muted">
                      {formatIstDateTime(occ.startAt, 'EEE d MMM, h:mm a')} · {occ.room || 'TBA'}
                    </p>
                  </div>
                  {occ.isOverride && <Badge tone="warning">override</Badge>}
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
