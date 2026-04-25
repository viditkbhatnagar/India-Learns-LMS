import { useMemo, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
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
    case 'not_started': return '—';
    case 'missing': return 'Missing';
    case 'submitted':
    case 'needs_grading': return 'To grade';
    case 'graded_draft': return 'Draft';
    case 'published': return 'Published';
    default: return s;
  }
}

/**
 * Gradebook grid — embedded inside the B-2 course shell. The shell already
 * renders the sticky header + oversight banner; this view just renders the
 * grid + counts. Same data model as B-1; routes link out to the per-
 * assignment grading view inside the shell (`./assignments/:id/grading`).
 */
export function CourseGradebookView({ courseId }: { courseId: string }): JSX.Element | null {
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
    if (sortKey === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
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
    for (const c of cells ?? []) m.set(`${c.studentId}::${c.assignmentId}`, c);
    return m;
  }, [cells]);

  if (!courseId) return null;
  if (q.isLoading) return <Skeleton variant="card" />;
  if (q.isError) {
    return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;
  const isEmpty = q.data.assignments.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-bold">Grading backlog</p>
            <p className="text-3xl font-bold text-brand-navy mt-1">{q.data.backlog}</p>
            <p className="text-xs text-muted mt-1">Submissions awaiting grading.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-bold">Drafts (faculty-only)</p>
            <p className="text-3xl font-bold text-brand-navy mt-1">{q.data.draftCount}</p>
            <p className="text-xs text-muted mt-1">Saved but not yet shown to students.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-bold">Published</p>
            <p className="text-3xl font-bold text-brand-navy mt-1">{q.data.publishedCount}</p>
            <p className="text-xs text-muted mt-1">Visible to students.</p>
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
            {me?.role === 'superadmin' && (
              <Link to="/admin/curriculum-import">
                <Button>Run curriculum import</Button>
              </Link>
            )}
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
              <span className="block text-xs uppercase tracking-wider text-muted font-bold mb-1.5">Sort</span>
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
                  {sortedAssignments.map((a) => (
                    <th
                      key={a.id}
                      className="text-left font-semibold px-3 py-2 border-b border-black/10 align-bottom min-w-[140px]"
                    >
                      <Link
                        to={`../assignments/${a.id}/grading`}
                        className="block hover:text-brand-orange"
                        title="Open per-assignment grading"
                      >
                        <span className="block truncate max-w-[160px]">{a.title}</span>
                        <span className="block text-[10px] text-muted font-mono mt-0.5">
                          Due {formatIstDate(a.dueAt)} · /{a.maxScore}
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={sortedAssignments.length + 1} className="text-center py-6 text-muted">
                      No students match the filter.
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-muted/50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-black/5 align-top">
                        <span className="font-semibold text-brand-navy">{s.name}</span>
                        {s.code && <p className="text-xs font-mono text-muted">{s.code}</p>}
                      </td>
                      {sortedAssignments.map((a) => {
                        const cell = cellMap.get(`${s.id}::${a.id}`);
                        return (
                          <td key={a.id} className="px-3 py-2 border-b border-black/5 align-top">
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
    </div>
  );
}

function CellChip({
  status, score, maxScore, isDraft, late,
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
          {score}<span className="text-muted">/{maxScore}</span>
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
        <span className="italic text-amber-900">{score}<span className="text-muted">/{maxScore}</span></span>
        <span className="ml-1.5 text-[10px] uppercase tracking-wider font-bold rounded bg-amber-100 text-amber-900 px-1 py-0.5">
          Draft
        </span>
      </div>
    );
  }
  return <Badge tone={statusToTone(status)} size="sm">{statusLabel(status)}</Badge>;
}
