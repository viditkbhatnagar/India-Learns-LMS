import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi, timetableApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatIstDateTime } from '../../lib/format.js';
import { useAuthStore } from '../../store/auth.js';

export function FacultyDashboard() {
  const me = useAuthStore((s) => s.user)!;
  const coursesQ = useQuery({ queryKey: ['courses'], queryFn: coursesApi.list });
  const timetableQ = useQuery({
    queryKey: ['me', 'timetable'],
    queryFn: () => timetableApi.mine({ week: isoWeekString(new Date()) }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Hello, {me.name.split(' ')[0]}</h1>
        <p className="text-muted text-sm mt-1">Your assigned courses and this week&apos;s classes.</p>
      </div>
      <Card>
        <CardHeader title="My courses" />
        {coursesQ.isLoading && <Skeleton lines={3} />}
        {coursesQ.isError && <ErrorAlert message={(coursesQ.error as Error).message} onRetry={() => coursesQ.refetch()} />}
        {coursesQ.data && (
          coursesQ.data.length === 0 ? (
            <EmptyState title="No courses assigned yet" message="Admin will assign you to a course shortly." />
          ) : (
            <ul className="divide-y divide-black/5">
              {coursesQ.data.filter((c) => c.facultyIds?.includes(me.id)).map((c) => (
                <li key={c.id} className="py-3">
                  <Link to={`/faculty/courses/${c.id}`} className="font-medium text-brand-navy hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted">{c.state} · {c.slug}</p>
                </li>
              ))}
            </ul>
          )
        )}
      </Card>
      <Card>
        <CardHeader title="This week" />
        {timetableQ.isLoading && <Skeleton lines={3} />}
        {timetableQ.data && (
          timetableQ.data.length === 0 ? (
            <EmptyState title="No classes this week" />
          ) : (
            <ul className="divide-y divide-black/5">
              {timetableQ.data.map((occ) => (
                <li key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt} className="py-2">
                  <p className="font-medium">{occ.courseName}</p>
                  <p className="text-xs text-muted">{formatIstDateTime(occ.startAt, 'EEE d MMM, h:mm a')} · {occ.room}</p>
                </li>
              ))}
            </ul>
          )
        )}
      </Card>
    </div>
  );
}

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
