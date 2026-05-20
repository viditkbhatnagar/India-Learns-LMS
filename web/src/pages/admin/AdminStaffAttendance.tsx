import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  STAFF_ATTENDANCE_STATUSES,
  type StaffAttendanceStatus,
  type UserPublicDto,
} from 'india-learns-shared-types';
import { staffAttendanceApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { UserPicker } from '../../components/ui/UserPicker.js';
import { ApiHttpError } from '../../lib/api.js';

// M10u — Admin staff attendance page. List + filter + mark on behalf.

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'On leave',
  half_day: 'Half day',
};

const STATUS_TONE: Record<
  StaffAttendanceStatus,
  'success' | 'danger' | 'warning' | 'info' | 'neutral'
> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  leave: 'info',
  half_day: 'neutral',
};

function todayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function AdminStaffAttendancePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StaffAttendanceStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const [showMark, setShowMark] = useState(false);

  const listQ = useQuery({
    queryKey: [
      'admin',
      'staff-attendance',
      { statusFilter, dateFrom, dateTo, userId },
    ],
    queryFn: () =>
      staffAttendanceApi.list({
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: userId || undefined,
      }),
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Staff records"
        title="Staff attendance"
        subtitle="Faculty self-mark each day from their dashboard. You can also mark on behalf or correct mistakes here."
        action={
          <Button onClick={() => setShowMark((v) => !v)}>
            {showMark ? 'Close' : 'Mark attendance'}
          </Button>
        }
      />

      {showMark && (
        <MarkForm
          onSaved={() => {
            setShowMark(false);
            qc.invalidateQueries({ queryKey: ['admin', 'staff-attendance'] });
          }}
        />
      )}

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            label="Staff user ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Optional — filter by user"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StaffAttendanceStatus | '')}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              <option value="">All</option>
              {STAFF_ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <Input
            type="date"
            label="From"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            label="To"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        {listQ.isLoading && <Skeleton lines={5} />}
        {listQ.isError && (
          <ErrorAlert
            message={(listQ.error as Error).message}
            onRetry={() => listQ.refetch()}
          />
        )}
        {listQ.data && listQ.data.items.length === 0 && (
          <EmptyState
            title="No attendance records"
            message="Either no one's marked yet, or your filters are too narrow."
          />
        )}
        {listQ.data && listQ.data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider">
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Marked by</th>
                  <th className="py-2 pr-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {listQ.data.items.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-muted/40">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-brand-navy">{row.userName}</p>
                    </td>
                    <td className="py-2.5 pr-3 capitalize text-xs text-muted">
                      {row.userRole}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.date}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={STATUS_TONE[row.status]} dot size="sm">
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      {row.markedByName}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MarkForm({ onSaved }: { onSaved: () => void }) {
  // M10w — Replaced inline search box + result list with UserPicker.
  // Filter to staff roles so admin can't pick a student by accident.
  const [staff, setStaff] = useState<UserPublicDto | null>(null);
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState<StaffAttendanceStatus>('present');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      staffAttendanceApi.mark({
        userId: staff?.id ?? undefined,
        date,
        status,
        notes: notes.trim() || null,
      }),
    onSuccess: () => onSaved(),
    onError: (err) =>
      setError(err instanceof ApiHttpError ? err.message : 'Failed to mark.'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!staff) {
      setError('Pick a staff member first.');
      return;
    }
    setError(null);
    save.mutate();
  }

  return (
    <Card>
      <CardHeader title="Mark attendance" subtitle="On behalf of a staff member." />
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <UserPicker
            label="Staff member"
            placeholder="Pick a faculty / admin…"
            value={staff}
            onChange={setStaff}
            filter={(u) =>
              ['admin', 'superadmin', 'faculty'].includes(u.role)
            }
            hint="Click to open, type to filter by name, email, or code."
            required
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Input
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs uppercase tracking-wider text-muted font-bold">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StaffAttendanceStatus)}
              className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
            >
              {STAFF_ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Late by 20 min etc."
          />
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl p-3 text-sm bg-red-50 border border-danger/30 text-danger"
          >
            {error}
          </div>
        )}
        <Button type="submit" loading={save.isPending}>
          Save attendance
        </Button>
      </form>
    </Card>
  );
}
