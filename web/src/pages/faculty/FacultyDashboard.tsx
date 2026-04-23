import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { coursesApi, timetableApi, facultyApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
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
  const gradingQ = useQuery({
    queryKey: ['faculty', 'grading-queue'],
    queryFn: facultyApi.gradingQueue,
    // Grading queue is optional — if endpoint 403s or errors we degrade.
    retry: false,
  });

  const myCourses = (coursesQ.data ?? []).filter((c) => c.facultyIds?.includes(me.id));
  const hourIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const greeting =
    Number(hourIst) < 12 ? 'Good morning' : Number(hourIst) < 17 ? 'Good afternoon' : 'Good evening';
  const classesThisWeek = timetableQ.data?.length ?? 0;
  const gradingPending = gradingQ.data?.length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero greeting. */}
      <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-brand-gradient text-white shadow-elev-3">
        <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
        <div className="relative">
          <p className="text-white/70 text-sm tracking-wide uppercase">{greeting}</p>
          <h1 className="text-display-md mt-1 text-white">
            {me.name.split(' ')[0]}
            <span className="text-brand-orange">.</span>
          </h1>
          <p className="mt-3 text-white/80 max-w-xl">
            {myCourses.length} course{myCourses.length === 1 ? '' : 's'} · {classesThisWeek} class
            {classesThisWeek === 1 ? '' : 'es'} this week
            {gradingPending > 0 && ` · ${gradingPending} awaiting your feedback`}.
          </p>
        </div>
      </section>

      {/* Stat row. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="My courses" value={myCourses.length.toString()} tone="info" />
        <StatTile label="Classes this week" value={classesThisWeek.toString()} tone="neutral" />
        <StatTile
          label="Awaiting grading"
          value={gradingPending.toString()}
          tone={gradingPending > 0 ? 'warning' : 'neutral'}
        />
        <StatTile label="Students" value="—" tone="neutral" sub="Coming soon" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        {/* Courses list */}
        <Card accent="navy">
          <CardHeader
            title="My courses"
            subtitle="Courses assigned to you"
            action={
              <Link
                to="/faculty/courses"
                className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
              >
                Manage →
              </Link>
            }
          />
          {coursesQ.isLoading && <Skeleton lines={3} />}
          {coursesQ.isError && (
            <ErrorAlert
              message={(coursesQ.error as Error).message}
              onRetry={() => coursesQ.refetch()}
            />
          )}
          {coursesQ.data && myCourses.length === 0 && (
            <EmptyState
              title="No courses assigned yet"
              message="Admin will assign you to a course shortly."
            />
          )}
          {myCourses.length > 0 && (
            <ul className="divide-y divide-black/5">
              {myCourses.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between gap-3 group">
                  <div className="min-w-0">
                    <Link
                      to={`/faculty/courses/${c.id}`}
                      className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors truncate block"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">{c.slug}</p>
                  </div>
                  <Badge
                    tone={c.state === 'published' ? 'success' : 'warning'}
                    dot
                  >
                    {c.state}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* This week */}
        <Card accent="orange">
          <CardHeader
            title="This week"
            subtitle="Your classes"
            action={
              <Link
                to="/faculty/timetable"
                className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
              >
                Full schedule →
              </Link>
            }
          />
          {timetableQ.isLoading && <Skeleton lines={3} />}
          {timetableQ.data && timetableQ.data.length === 0 && (
            <EmptyState title="No classes this week" />
          )}
          {timetableQ.data && timetableQ.data.length > 0 && (
            <ul className="space-y-3">
              {timetableQ.data.slice(0, 5).map((occ) => (
                <li
                  key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt}
                  className="flex items-start gap-3 rounded-xl bg-surface-muted p-3"
                >
                  <div className="shrink-0 w-12 text-center rounded-lg bg-white shadow-elev-1 py-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
                      {formatIstDateTime(occ.startAt, 'MMM')}
                    </p>
                    <p className="text-base font-bold text-brand-navy leading-none">
                      {formatIstDateTime(occ.startAt, 'd')}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-navy truncate">{occ.courseName}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatIstDateTime(occ.startAt, 'EEE · h:mm a')}
                      {occ.room && ` · ${occ.room}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'info' | 'warning' | 'success';
  sub?: string;
}) {
  const numberTone: Record<typeof tone, string> = {
    neutral: 'text-brand-navy',
    info: 'text-brand-navy',
    warning: 'text-warning',
    success: 'text-success',
  };
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-elev-1 p-5">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className={`mt-2 text-2xl font-bold font-mono tabular-nums count-up ${numberTone[tone]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
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
