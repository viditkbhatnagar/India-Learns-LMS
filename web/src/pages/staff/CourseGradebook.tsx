import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { assignmentsApi, type SubmissionStatus } from '../../lib/endpoints.js';
import { formatIstDate } from '../../lib/format.js';
import { useAuthStore } from '../../store/auth.js';

type ComputedStatus = SubmissionStatus | 'not_started' | 'missing';
type SortKey = 'name' | 'due';

function statusToTone(s: ComputedStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (s === 'published') return 'success';
  if (s === 'graded_draft') return 'warning';
  if (s === 'submitted' || s === 'needs_grading') return 'info';
  if (s === 'missing') return 'danger';
  return 'neutral';
}

function statusLabel(s: ComputedStatus): string {
  switch (s) {
    case 'not_started':
      return '—';
    case 'missing':
      return 'Missing';
    case 'submitted':
    case 'needs_grading':
      return 'To grade';
    case 'graded_draft':
      return 'Draft';
    case 'published':
      return 'Published';
    default:
      return s;
  }
}

export function CourseGradebookPage(): JSX.Element | null {
  // Both `courseId` (admin) and `id` (faculty) param shapes are accepted so
  // the same component mounts under /admin/courses/:courseId/gradebook and
  // /faculty/courses/:id/gradebook.
  const params = useParams<{ courseId?: string; id?: string }>();
  const courseId = params.courseId ?? params.id ?? '';
  const me = useAuthStore((s) => s.user);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [filter, setFilter] = useState('');

  const q = useQuery({
    queryKey: ['gradebook', courseId],
    queryFn: () => assignmentsApi.gradebook(courseId),
    enabled: Boolean(courseId),
  });

  const sortedStudents = useMemo(() => {
    if (!q.data) return [];
    const list = [...q.data.students];
    if (sortKey === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (filter.trim()) {
      const needle = filter.trim().toLowerCase();
      return list.filter(
        (s) =>
          s.name.toLowerCase().includes(needle)
          || s.email.toLowerCase().includes(needle)
          || (s.code ?? '').toLowerCase().includes(needle),
      );
    }
    return list;
  }, [q.data, sortKey, filter]);

  const sortedAssignments = useMemo(() => {
    if (!q.data) return [];
    const list = [...q.data.assignments];
    if (sortKey === 'due') {
      list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    }
    return list;
  }, [q.data, sortKey]);

  const cells = q.data?.cells;
  const cellMap = useMemo(() => {
    type Cell = NonNullable<typeof cells>[number];
    const m = new Map<string, Cell>();
    for (const c of cells ?? []) {
      m.set(`${c.studentId}::${c.assignmentId}`, c);
    }
    return m;
  }, [cells]);

  const isOversight = me?.role === 'superadmin'; // a superadmin viewing any course
  // Faculty viewing own course → no banner. Superadmin → banner regardless of
  // whether they're a faculty on the course (we keep it simple per OPEN-QUESTIONS).
  const showOversightBanner = isOversight;

  if (!courseId) return null;

  const isEmpty = q.data && q.data.assignments.length === 0;
  const studentBackPath = me?.role === 'faculty' ? '/faculty/courses' : '/admin/courses';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Course"
        title={q.data?.course.name ?? 'Gradebook'}
        subtitle={
          q.data
            ? `${q.data.assignments.length} assignment${q.data.assignments.length === 1 ? '' : 's'} · ${q.data.students.length} student${q.data.students.length === 1 ? '' : 's'}`
            : 'Gradebook'
        }
        back={{ to: studentBackPath, label: 'Back to courses' }}
      />

      {showOversightBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <strong>Oversight mode.</strong> You're viewing this course as a super
          admin. Any draft you save or grade you publish will be audit-logged
          under your account.
        </div>
      )}

      {q.isLoading && <Skeleton variant="card" />}
      {q.isError && (
        <ErrorAlert
          message={(q.error as Error).message}
          onRetry={() => q.refetch()}
        />
      )}

      {q.data && (
        <>
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-bold">
                  Grading backlog
                </p>
                <p className="text-3xl font-bold text-brand-navy mt-1">
                  {q.data.backlog}
                </p>
                <p className="text-xs text-muted mt-1">
                  Submissions awaiting grading.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-bold">
                  Drafts (faculty-only)
                </p>
                <p className="text-3xl font-bold text-brand-navy mt-1">
                  {q.data.draftCount}
                </p>
                <p className="text-xs text-muted mt-1">
                  Saved but not yet shown to students.
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-bold">
                  Published
                </p>
                <p className="text-3xl font-bold text-brand-navy mt-1">
                  {q.data.publishedCount}
                </p>
                <p className="text-xs text-muted mt-1">
                  Visible to students.
                </p>
              </div>
            </div>
          </Card>

          {isEmpty ? (
            <Card accent="orange">
              <CardHeader
                title="No assignments yet"
                subtitle="The gradebook becomes useful once this course has assignments."
              />
              <div className="flex gap-3">
                <Link to="/admin/curriculum-import">
                  <Button>Run curriculum import</Button>
                </Link>
                <Link to="/admin/courses">
                  <Button variant="ghost">Back to courses</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mb-4">
                <div className="flex-1 w-full max-w-xs">
                  <Input
                    placeholder="Filter students…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-muted font-bold mb-1.5">
                    Sort
                  </span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
                  >
                    <option value="name">Student name</option>
                    <option value="due">Assignment due date</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="min-w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white text-left font-semibold px-3 py-2 border-b border-black/10 min-w-[180px]">
                        Student
                      </th>
                      {sortedAssignments.map((a) => {
                        const linkBase = me?.role === 'faculty'
                          ? `/faculty/courses/${courseId}/assignments/${a.id}/grading`
                          : `/admin/courses/${courseId}/assignments/${a.id}/grading`;
                        return (
                          <th
                            key={a.id}
                            className="text-left font-semibold px-3 py-2 border-b border-black/10 align-bottom min-w-[140px]"
                          >
                            <Link
                              to={linkBase}
                              className="block hover:text-brand-orange"
                              title="Open per-assignment grading"
                            >
                              <span className="block truncate max-w-[160px]">{a.title}</span>
                              <span className="block text-[10px] text-muted font-mono mt-0.5">
                                Due {formatIstDate(a.dueAt)} · /{a.maxScore}
                              </span>
                            </Link>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={sortedAssignments.length + 1}
                          className="text-center py-6 text-muted"
                        >
                          No students match the filter.
                        </td>
                      </tr>
                    ) : (
                      sortedStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-surface-muted/50">
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-black/5 align-top">
                            <Link
                              to={
                                me?.role === 'faculty'
                                  ? `/faculty/students/${s.id}`
                                  : `/admin/users/${s.id}`
                              }
                              className="font-semibold text-brand-navy hover:text-brand-orange"
                            >
                              {s.name}
                            </Link>
                            {s.code && (
                              <p className="text-xs font-mono text-muted">{s.code}</p>
                            )}
                          </td>
                          {sortedAssignments.map((a) => {
                            const cell = cellMap.get(`${s.id}::${a.id}`);
                            return (
                              <td
                                key={a.id}
                                className="px-3 py-2 border-b border-black/5 align-top"
                              >
                                <CellChip
                                  status={cell?.computedStatus ?? 'not_started'}
                                  score={cell?.score ?? null}
                                  maxScore={a.maxScore}
                                  isDraft={cell?.isDraft ?? false}
                                  late={cell?.lateFlag ?? false}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function CellChip({
  status,
  score,
  maxScore,
  isDraft,
  late,
}: {
  status: ComputedStatus;
  score: number | null;
  maxScore: number;
  isDraft: boolean;
  late: boolean;
}): JSX.Element {
  if (status === 'published' && score !== null) {
    return (
      <div>
        <span className="font-semibold text-brand-navy">
          {score}
          <span className="text-muted">/{maxScore}</span>
        </span>
        {late && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wider font-bold rounded bg-amber-100 text-amber-900 px-1 py-0.5">
            Late
          </span>
        )}
      </div>
    );
  }
  if (isDraft && score !== null) {
    return (
      <div>
        <span className="italic text-amber-900">
          {score}
          <span className="text-muted">/{maxScore}</span>
        </span>
        <span className="ml-1.5 text-[10px] uppercase tracking-wider font-bold rounded bg-amber-100 text-amber-900 px-1 py-0.5">
          Draft
        </span>
      </div>
    );
  }
  return (
    <Badge tone={statusToTone(status)} size="sm">
      {statusLabel(status)}
    </Badge>
  );
}
