import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { batchSessionsApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { formatIstDateTime } from '../../lib/format.js';

// M10o — Per-batch attendance landing page. Lists today's sessions for
// a batch across every course; each session has a Mark attendance
// button that jumps straight to the existing SessionDetail screen (which
// already has the attendance roster + per-student status pickers).
//
// Linked from the Faculty Dashboard "This week" cards so the user-doc
// ask — "click batch from dashboard → directly attendance" — is now one
// click on the dashboard, then one click on the specific session.

function todayIst(): string {
  // IST = UTC+5:30. Construct YYYY-MM-DD in IST so the picker defaults
  // to the local school day even when the browser is on UTC.
  const nowMs = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function BatchAttendancePage() {
  const { batchId = '' } = useParams<{ batchId: string }>();
  const [date, setDate] = useState<string>(todayIst());

  const q = useQuery({
    queryKey: ['batch-sessions', batchId, date],
    queryFn: () => batchSessionsApi.list(batchId, date),
    enabled: Boolean(batchId),
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Attendance"
        title="Sessions today"
        subtitle="Pick a session below to mark or update attendance for this batch."
        back={{ to: '/faculty/dashboard', label: 'Back to dashboard' }}
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hint="Defaults to today (IST)."
          />
          <Button onClick={() => setDate(todayIst())}>Today</Button>
        </div>
      </Card>

      {q.isLoading && <Skeleton lines={3} />}
      {q.isError && (
        <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />
      )}
      {q.data && q.data.sessions.length === 0 && (
        <Card>
          <EmptyState
            title="No sessions scheduled"
            message="Nothing on the timetable for this batch on the selected date. Try another day."
          />
        </Card>
      )}
      {q.data && q.data.sessions.length > 0 && (
        <Card>
          <CardHeader
            title={`${q.data.sessions.length} session${q.data.sessions.length === 1 ? '' : 's'}`}
            subtitle={new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          />
          <ul className="divide-y divide-black/5">
            {q.data.sessions.map((s) => {
              const marked = s.attendanceRecorded;
              const total = s.enrolledStudents;
              const tone = marked >= total ? 'success' : marked > 0 ? 'warning' : 'neutral';
              return (
                <li key={s.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy truncate">{s.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {s.courseName}
                      {s.scheduledStart && (
                        <>
                          {' · '}
                          {formatIstDateTime(s.scheduledStart, 'EEE · h:mm a')}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={tone} dot>
                      {marked}/{total} marked
                    </Badge>
                    <Link to={`/faculty/courses/${s.courseId}/sessions/${s.id}`}>
                      <Button>{marked > 0 ? 'Update' : 'Mark attendance'}</Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
