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

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError)
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;

  const dash = query.data!;
  const outstanding = dash.outstandingFees;
  const outstandingPaise =
    'totalPaise' in outstanding ? outstanding.totalPaise : (outstanding as { balancePaise?: number }).balancePaise ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Welcome back, {dash.student.name.split(' ')[0]}</h1>
        <p className="text-muted text-sm mt-1">
          {dash.student.code && <span className="mono">{dash.student.code} · </span>}
          {dash.enrolments.length} active enrolment{dash.enrolments.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Next class">
          {dash.nextClass.value ? (
            <>
              <p className="font-semibold text-brand-navy">
                {dash.nextClass.value.courseName}
              </p>
              <p className="text-sm text-muted">
                {formatIstDateTime(dash.nextClass.value.startAt)}
              </p>
            </>
          ) : (
            <p className="text-muted text-sm">No classes scheduled this week.</p>
          )}
        </Tile>
        <Tile label="Outstanding fees">
          <p className="font-semibold text-brand-navy">{formatMoney(outstandingPaise)}</p>
          <Link to="/student/fees" className="text-xs text-brand-orange hover:underline">
            View breakdown →
          </Link>
        </Tile>
        <Tile label="Open tickets">
          <p className="font-semibold text-brand-navy">{dash.openTickets.count}</p>
          <Link to="/student/tickets" className="text-xs text-brand-orange hover:underline">
            Support centre →
          </Link>
        </Tile>
        <Tile label="Unread notifications">
          <p className="font-semibold text-brand-navy">{dash.unreadNotifications.count}</p>
          <Link to="/profile/notifications" className="text-xs text-brand-orange hover:underline">
            Preferences →
          </Link>
        </Tile>
        <Tile label="New feedback">
          <p className="font-semibold text-brand-navy">{dash.newFeedback.count}</p>
          <Link to="/student/feedback" className="text-xs text-brand-orange hover:underline">
            Review →
          </Link>
        </Tile>
        <Tile label="Certificates">
          <p className="font-semibold text-brand-navy">{dash.certificates.count}</p>
          <Link to="/student/certificates" className="text-xs text-brand-orange hover:underline">
            Download →
          </Link>
        </Tile>
      </div>

      <Card>
        <CardHeader
          title="My courses"
          action={
            <Link to="/student/courses" className="text-sm text-brand-orange hover:underline">
              See all
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
              <li key={e.id} className="py-3 flex items-center justify-between">
                <div>
                  <Link to={`/student/courses/${e.courseId}`} className="font-medium text-brand-navy hover:underline">
                    Course {e.courseId.slice(-6)}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    Valid to {new Date(e.validTo).toLocaleDateString()} ·{' '}
                    <span className="capitalize">{e.accessState}</span>
                  </p>
                </div>
                <Badge tone={e.accessState === 'active' ? 'success' : e.accessState === 'suspended' ? 'danger' : 'warning'}>
                  {e.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">{label}</p>
      {children}
    </Card>
  );
}
