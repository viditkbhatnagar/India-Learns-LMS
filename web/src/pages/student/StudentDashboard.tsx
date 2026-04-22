import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studentsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { formatMoney, formatIstDateTime } from '../../lib/format.js';

export function StudentDashboard() {
  const query = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: studentsApi.dashboard,
  });

  if (query.isLoading) return <Skeleton lines={8} />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  const dash = query.data!;
  const outstanding = dash.outstandingFees;
  const outstandingPaise =
    'totalPaise' in outstanding
      ? outstanding.totalPaise
      : (outstanding as { balancePaise?: number }).balancePaise ?? 0;

  const firstName = dash.student.name.split(' ')[0];
  const hourIst = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });
  const greeting =
    Number(hourIst) < 12 ? 'Good morning' : Number(hourIst) < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero greeting card with next-class emphasis. */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-brand-gradient text-white shadow-elev-3"
        aria-labelledby="dash-hello"
      >
        <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
        <div className="relative grid gap-6 md:grid-cols-[1.2fr,1fr] md:items-center">
          <div>
            <p className="text-white/70 text-sm tracking-wide uppercase">{greeting}</p>
            <h1 id="dash-hello" className="text-display-md mt-1 text-white">
              {firstName}
              <span className="text-brand-orange">.</span>
            </h1>
            <p className="mt-3 text-white/80 max-w-md">
              {dash.student.code && (
                <span className="font-mono text-white/60 mr-2">{dash.student.code}</span>
              )}
              {dash.enrolments.length} active enrolment
              {dash.enrolments.length === 1 ? '' : 's'} · stay on track this week.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 p-5">
            <p className="text-xs uppercase tracking-wider text-white/60 font-semibold mb-2">
              Next class
            </p>
            {dash.nextClass.value ? (
              <>
                <p className="text-white text-lg font-semibold leading-tight">
                  {dash.nextClass.value.courseName}
                </p>
                <p className="text-white/80 text-sm mt-1">
                  {formatIstDateTime(dash.nextClass.value.startAt)}
                </p>
                <Link
                  to="/student/timetable"
                  className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-brand-orange hover:text-orange-300 transition-colors"
                >
                  View full timetable →
                </Link>
              </>
            ) : (
              <>
                <p className="text-white/80 text-sm">No classes scheduled this week.</p>
                <Link
                  to="/student/timetable"
                  className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-brand-orange hover:text-orange-300 transition-colors"
                >
                  Open timetable →
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Stat tiles. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Outstanding fees"
          value={formatMoney(outstandingPaise)}
          tone={outstandingPaise > 0 ? 'warning' : 'neutral'}
          href="/student/fees"
          cta="View breakdown"
        />
        <StatTile
          label="Open tickets"
          value={dash.openTickets.count.toString()}
          tone={dash.openTickets.count > 0 ? 'info' : 'neutral'}
          href="/student/tickets"
          cta="Support centre"
        />
        <StatTile
          label="Unread notifications"
          value={dash.unreadNotifications.count.toString()}
          tone={dash.unreadNotifications.count > 0 ? 'accent' : 'neutral'}
          href="/profile/notifications"
          cta="Preferences"
        />
        <StatTile
          label="Certificates"
          value={dash.certificates.count.toString()}
          tone={dash.certificates.count > 0 ? 'success' : 'neutral'}
          href="/student/certificates"
          cta="Download"
        />
      </div>

      {/* Two-column: courses + quick actions */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <Card accent="navy">
          <CardHeader
            title="My courses"
            subtitle="Jump back into your learning"
            action={
              <Link
                to="/student/courses"
                className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
              >
                See all →
              </Link>
            }
          />
          {dash.enrolments.length === 0 ? (
            <EmptyState
              title="No active enrolments"
              message="Once admin enrols you in a program, your courses will appear here."
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {dash.enrolments.slice(0, 4).map((e) => (
                <li
                  key={e.id}
                  className="py-3 flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/student/courses/${e.courseId}`}
                      className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors"
                    >
                      Course {e.courseId.slice(-6)}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      Valid to {new Date(e.validTo).toLocaleDateString()} ·{' '}
                      <span className="capitalize">{e.accessState}</span>
                    </p>
                  </div>
                  <Badge
                    tone={
                      e.accessState === 'active'
                        ? 'success'
                        : e.accessState === 'suspended'
                          ? 'danger'
                          : 'warning'
                    }
                    dot
                  >
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card accent="orange">
          <CardHeader title="Quick actions" subtitle="Common tasks" />
          <div className="grid gap-3">
            <QuickAction to="/student/fees" label="View my fees" tone="orange" />
            <QuickAction to="/student/tickets/new" label="Raise a ticket" tone="navy" />
            <QuickAction to="/student/feedback" label="Review feedback" tone="navy" />
            <QuickAction to="/student/certificates" label="My certificates" tone="navy" />
          </div>
          <div className="mt-5 rounded-xl bg-surface-muted p-3 text-xs text-muted">
            Need help?{' '}
            <Link to="/student/tickets/new" className="text-brand-navy font-medium hover:underline">
              Contact the team →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  href,
  cta,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
  href: string;
  cta: string;
}) {
  const accentBar: Record<typeof tone, string> = {
    neutral: 'bg-muted/40',
    info: 'bg-brand-navy',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    accent: 'bg-brand-orange',
  };
  return (
    <Link
      to={href}
      className="group relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-elev-1 hover:shadow-elev-3 hover:-translate-y-0.5 transition-all duration-200 ease-bounce focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 focus-visible:ring-offset-2 p-5 block"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar[tone]}`} aria-hidden />
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-bold text-brand-navy count-up">{value}</p>
      <p className="mt-3 text-xs font-medium text-brand-navy/60 group-hover:text-brand-orange transition-colors">
        {cta} →
      </p>
    </Link>
  );
}

function QuickAction({
  to,
  label,
  tone,
}: {
  to: string;
  label: string;
  tone: 'orange' | 'navy';
}) {
  return (
    <Link
      to={to}
      className={[
        'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
        tone === 'orange'
          ? 'bg-accent-gradient text-white shadow-elev-1 hover:shadow-glow-orange hover:-translate-y-0.5'
          : 'bg-white border border-navy-200 text-brand-navy hover:border-navy-300 hover:bg-navy-50',
      ].join(' ')}
    >
      <span>{label}</span>
      <span aria-hidden className="text-lg leading-none">→</span>
    </Link>
  );
}

