import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AssignmentSubmissionsReportDto,
  AttendanceReportDto,
  BatchDto,
  BatchSummaryReportDto,
  CourseDto,
} from 'india-learns-shared-types';
import { batchesApi, coursesApi, reportsApi } from '../lib/endpoints.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert, EmptyState } from '../components/ui/States.js';
import { PageHeader } from '../components/ui/PageHeader.js';

// M10 — Reports module (LMS_Faculty_Features §4). Three batch-scoped
// reports with JSON preview + XLSX download. Tab-style switcher; the
// filter row above adjusts to whichever tab is active.
//
// Faculty see the same UI as admin/finance — the API layer enforces that
// they can only pull batches they teach. The error surface for that is
// the standard 403 ErrorAlert.

type ReportKind = 'attendance' | 'batch-summary' | 'assignment-submissions';

const KIND_LABEL: Record<ReportKind, string> = {
  attendance: 'Attendance',
  'batch-summary': 'Batch summary',
  'assignment-submissions': 'Assignment submissions',
};

const KIND_DESCRIPTION: Record<ReportKind, string> = {
  attendance:
    'Per-student presence over a date range. Excused sessions excluded from the rate.',
  'batch-summary':
    'One-page rollup — enrolment, average attendance, assignment status counts, fees collected vs outstanding.',
  'assignment-submissions':
    'Matrix of submission status per assignment per student in the date range.',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthAgoIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('attendance');
  const [batchId, setBatchId] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');
  const [from, setFrom] = useState<string>(monthAgoIso());
  const [to, setTo] = useState<string>(todayIso());
  const [downloadErr, setDownloadErr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const batchesQ = useQuery({
    queryKey: ['batches'],
    queryFn: async () => (await batchesApi.list()) as BatchDto[],
  });
  const coursesQ = useQuery({
    queryKey: ['courses'],
    queryFn: async () => (await coursesApi.list()) as CourseDto[],
  });

  // Auto-pick first batch when batches load if none selected.
  useEffect(() => {
    if (!batchId && batchesQ.data && batchesQ.data.length > 0) {
      setBatchId(batchesQ.data[0]!.id);
    }
  }, [batchesQ.data, batchId]);

  const needsRange = kind !== 'batch-summary';
  const filtersReady = Boolean(
    batchId && (kind === 'batch-summary' || (from && to && from <= to)),
  );

  const queryKey = [kind, batchId, from, to, courseId || '_all'];
  const reportQ = useQuery({
    queryKey,
    enabled: filtersReady,
    queryFn: async () => {
      if (kind === 'attendance') {
        return reportsApi.attendance({
          batchId,
          from,
          to,
          courseId: courseId || undefined,
        });
      }
      if (kind === 'batch-summary') {
        return reportsApi.batchSummary({ batchId });
      }
      return reportsApi.assignmentSubmissions({
        batchId,
        from,
        to,
        courseId: courseId || undefined,
      });
    },
  });

  async function handleDownload() {
    setDownloadErr(null);
    setDownloading(true);
    try {
      const params: Record<string, string> = { batchId };
      if (needsRange) {
        params.from = from;
        params.to = to;
        if (courseId) params.courseId = courseId;
      }
      const blob = await reportsApi.downloadXlsx(kind, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-${batchId}-${needsRange ? `${from}-to-${to}` : 'summary'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadErr(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  const courseOptions = useMemo(() => {
    if (!coursesQ.data || !batchId) return [] as CourseDto[];
    // Show courses for any program for now — the server-side enrolment
    // join scopes data to the batch. Future PR can filter by batch.
    return coursesQ.data;
  }, [coursesQ.data, batchId]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Reports"
        subtitle="Download per-batch attendance, summary, and assignment status reports for staff review and stakeholder updates."
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report type">
        {(Object.keys(KIND_LABEL) as ReportKind[]).map((k) => {
          const active = k === kind;
          return (
            <button
              type="button"
              key={k}
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-navy text-white shadow-elev-2'
                  : 'bg-white border border-black/5 text-brand-navy hover:border-brand-navy/30'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted">{KIND_DESCRIPTION[kind]}</p>

      {/* Filters */}
      <Card>
        <CardHeader title="Filters" subtitle="Pick a batch and (for date-scoped reports) a window." />
        {batchesQ.isLoading && <Skeleton lines={2} />}
        {batchesQ.isError && (
          <ErrorAlert
            message={(batchesQ.error as Error).message}
            onRetry={() => batchesQ.refetch()}
          />
        )}
        {batchesQ.data && batchesQ.data.length === 0 && (
          <EmptyState
            title="No batches yet"
            message="Create a batch under Programs → Batches to enable reports."
          />
        )}
        {batchesQ.data && batchesQ.data.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs uppercase tracking-wider text-muted font-bold">Batch</span>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
              >
                {batchesQ.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {needsRange && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted font-bold">From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted font-bold">To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs uppercase tracking-wider text-muted font-bold">
                    Course (optional)
                  </span>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
                  >
                    <option value="">All courses in batch</option>
                    {courseOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-5 pt-5 border-t border-black/5">
          <Button
            onClick={handleDownload}
            loading={downloading}
            disabled={!filtersReady || reportQ.isLoading}
          >
            Download Excel (.xlsx)
          </Button>
          {downloadErr && (
            <span role="alert" className="text-sm text-danger">
              {downloadErr}
            </span>
          )}
          {reportQ.data && (
            <span className="text-xs text-muted">
              Preview generated at{' '}
              {new Date((reportQ.data as { generatedAt: string }).generatedAt).toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </Card>

      {/* Preview */}
      {reportQ.isLoading && <Skeleton lines={6} />}
      {reportQ.isError && (
        <ErrorAlert
          message={(reportQ.error as Error).message}
          onRetry={() => reportQ.refetch()}
        />
      )}
      {reportQ.data && kind === 'attendance' && (
        <AttendancePreview report={reportQ.data as AttendanceReportDto} />
      )}
      {reportQ.data && kind === 'batch-summary' && (
        <BatchSummaryPreview report={reportQ.data as BatchSummaryReportDto} />
      )}
      {reportQ.data && kind === 'assignment-submissions' && (
        <SubmissionsPreview report={reportQ.data as AssignmentSubmissionsReportDto} />
      )}
    </div>
  );
}

function AttendancePreview({ report }: { report: AttendanceReportDto }) {
  return (
    <Card>
      <CardHeader
        title={`Attendance — ${report.batchCode}`}
        subtitle={`${report.programName} · ${report.sessionCount} session${
          report.sessionCount === 1 ? '' : 's'
        } in window · ${report.rows.length} student${report.rows.length === 1 ? '' : 's'}`}
      />
      {report.rows.length === 0 ? (
        <EmptyState title="No rows" message="No enrolments matched the filters." />
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5">
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Student</th>
                <th className="py-3 pr-4 text-right">Present</th>
                <th className="py-3 pr-4 text-right">Absent</th>
                <th className="py-3 pr-4 text-right">Late</th>
                <th className="py-3 pr-4 text-right">Excused</th>
                <th className="py-3 pr-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {report.rows.map((r) => (
                <tr key={r.studentId} className="hover:bg-surface-muted/50">
                  <td className="py-2.5 pr-4 font-mono text-xs">{r.studentCode ?? '—'}</td>
                  <td className="py-2.5 pr-4 font-medium text-brand-navy">{r.studentName}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.presentCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.absentCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.lateCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{r.excusedCount}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums font-semibold">
                    {r.totalMarked > 0 ? `${r.attendanceRate.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BatchSummaryPreview({ report }: { report: BatchSummaryReportDto }) {
  const inr = (paise: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SummaryTile label="Enrolled students" value={String(report.enrolledStudentCount)} sub={`${report.activeStudentCount} active`} />
      <SummaryTile label="Sessions held" value={String(report.totalSessions)} />
      <SummaryTile
        label="Average attendance"
        value={`${report.averageAttendanceRate.toFixed(1)}%`}
        tone={report.averageAttendanceRate >= 75 ? 'success' : report.averageAttendanceRate >= 50 ? 'warning' : 'danger'}
      />
      <SummaryTile label="Total assignments" value={String(report.totalAssignments)} />
      <SummaryTile
        label="Submissions published"
        value={String(report.publishedSubmissionCount)}
        sub={`${report.draftSubmissionCount} drafts · ${report.needsGradingCount} awaiting`}
      />
      <SummaryTile
        label="Outstanding fees"
        value={inr(report.totalOutstandingPaise)}
        sub={`${inr(report.totalCollectedPaise)} collected of ${inr(report.totalBilledPaise)}`}
        tone={report.totalOutstandingPaise > 0 ? 'warning' : 'success'}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const valueTone =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-brand-navy';
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-muted font-bold">{label}</p>
      <p className={`mt-2 text-2xl font-bold font-mono tabular-nums ${valueTone}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function SubmissionsPreview({ report }: { report: AssignmentSubmissionsReportDto }) {
  // Pivot cells to a matrix for fast rendering.
  const cellMap = new Map<string, (typeof report.cells)[number]>();
  for (const c of report.cells) cellMap.set(`${c.assignmentId}::${c.studentId}`, c);

  return (
    <Card>
      <CardHeader
        title={`Assignment submissions — ${report.batchCode}`}
        subtitle={`${report.assignments.length} assignment${
          report.assignments.length === 1 ? '' : 's'
        } in window · ${report.students.length} student${
          report.students.length === 1 ? '' : 's'
        }`}
      />
      {report.assignments.length === 0 || report.students.length === 0 ? (
        <EmptyState
          title="Nothing to show"
          message="No assignments or no students match these filters."
        />
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5">
                <th className="py-3 pr-4 sticky left-0 bg-white">Student</th>
                {report.assignments.map((a) => (
                  <th key={a.id} className="py-3 pr-3 text-center whitespace-nowrap">
                    <span className="block font-bold text-brand-navy">{a.title}</span>
                    <span className="block font-normal text-[10px] text-muted">{a.courseName}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {report.students.map((s) => (
                <tr key={s.id} className="hover:bg-surface-muted/50">
                  <td className="py-2.5 pr-4 sticky left-0 bg-white">
                    <span className="font-medium text-brand-navy">{s.name}</span>
                    {s.code && <span className="block font-mono text-[10px] text-muted">{s.code}</span>}
                  </td>
                  {report.assignments.map((a) => {
                    const cell = cellMap.get(`${a.id}::${s.id}`);
                    return (
                      <td key={a.id} className="py-2.5 pr-3 text-center">
                        <StatusBadge cell={cell} maxScore={a.maxScore} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StatusBadge({
  cell,
  maxScore,
}: {
  cell?: (AssignmentSubmissionsReportDto['cells'][number]);
  maxScore: number;
}) {
  if (!cell || cell.status === 'not_started')
    return <Badge tone="neutral" size="sm">Not started</Badge>;
  if (cell.status === 'submitted')
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge tone="info" size="sm">Submitted</Badge>
        {cell.lateFlag && <span className="text-[10px] text-warning">late</span>}
      </span>
    );
  if (cell.status === 'needs_grading') return <Badge tone="warning" size="sm">Needs grading</Badge>;
  if (cell.status === 'graded_draft') return <Badge tone="accent" size="sm">Draft</Badge>;
  // published
  return (
    <span className="inline-flex flex-col gap-0.5 items-center">
      <Badge tone="success" size="sm">Published</Badge>
      {typeof cell.score === 'number' && (
        <span className="text-[10px] font-mono text-muted">
          {cell.score} / {maxScore}
        </span>
      )}
    </span>
  );
}
