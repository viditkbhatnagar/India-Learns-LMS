import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { ErrorAlert, EmptyState, Skeleton } from '../../components/ui/States.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import {
  assignmentsApi,
  type AssignmentSubmissionWithStudent,
} from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';
import { useAuthStore } from '../../store/auth.js';

type FilterChip = 'needs_grading' | 'drafts' | 'graded' | 'missing';

const FILTERS: Array<{ key: FilterChip; label: string }> = [
  { key: 'needs_grading', label: 'Needs grading' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'graded', label: 'Graded' },
  { key: 'missing', label: 'Missing' },
];

interface RubricCriterion {
  criterionName: string;
  linkedMLOs: string[];
  weight: number;
  fail: string;
  pass: string;
  merit: string;
  distinction: string;
}

export function AssignmentGradingPage(): JSX.Element | null {
  const params = useParams<{ courseId?: string; assignmentId?: string }>();
  const courseId = params.courseId ?? '';
  const assignmentId = params.assignmentId ?? '';
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterChip>('needs_grading');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assignmentQ = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => assignmentsApi.get(assignmentId),
    enabled: Boolean(assignmentId),
  });
  const subsQ = useQuery({
    queryKey: ['assignment', assignmentId, 'submissions', filter],
    queryFn: () => assignmentsApi.listSubmissions(assignmentId, { status: filter }),
    enabled: Boolean(assignmentId),
  });

  // Reset selection when the filter changes — bulk publish only makes sense
  // within "Drafts".
  useEffect(() => {
    setSelected(new Set());
  }, [filter]);

  const bulkPublishMut = useMutation({
    mutationFn: () => assignmentsApi.bulkPublish(Array.from(selected)),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] });
    },
  });

  const isOversight = me?.role === 'superadmin';

  if (!assignmentId) return null;

  const rubric = (assignmentQ.data?.assignment as { rubric?: RubricCriterion[] } | undefined)?.rubric ?? [];
  const maxScore = assignmentQ.data?.assignment.maxScore ?? 100;
  const submissions = subsQ.data?.items ?? [];
  const missing = subsQ.data?.missing ?? [];
  const draftIds = submissions
    .filter((s) => s.status === 'graded_draft')
    .map((s) => s.id);

  const backPath = me?.role === 'faculty'
    ? `/faculty/courses/${courseId}/gradebook`
    : `/admin/courses/${courseId}/gradebook`;

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Grading"
        title={assignmentQ.data?.assignment.title ?? 'Assignment'}
        subtitle={
          assignmentQ.data
            ? `Due ${formatIstDateTime(assignmentQ.data.assignment.dueAt)} · /${maxScore}`
            : undefined
        }
        back={{ to: backPath, label: 'Back to gradebook' }}
      />

      {isOversight && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
          <strong>Oversight mode.</strong> Drafts and publishes will record
          your account in the audit log.
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                'px-3 py-1.5 rounded-full border text-sm transition-colors',
                filter === f.key
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-brand-navy border-black/10 hover:bg-surface-muted',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
          {filter === 'drafts' && draftIds.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted">{selected.size} of {draftIds.length} selected</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelected(new Set(draftIds))}
                disabled={selected.size === draftIds.length}
              >
                Select all drafts
              </Button>
              <Button
                size="sm"
                onClick={() => bulkPublishMut.mutate()}
                loading={bulkPublishMut.isPending}
                disabled={selected.size === 0}
              >
                Publish selected ({selected.size})
              </Button>
            </div>
          )}
        </div>
        {bulkPublishMut.data && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Published {bulkPublishMut.data.published.length}; skipped{' '}
            {bulkPublishMut.data.skipped.length}; failed{' '}
            {bulkPublishMut.data.failed.length}.
            {bulkPublishMut.data.failed.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs">
                {bulkPublishMut.data.failed.map((f) => (
                  <li key={f.submissionId}>{f.submissionId}: {f.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {(assignmentQ.isLoading || subsQ.isLoading) && <Skeleton variant="card" />}
      {assignmentQ.isError && (
        <ErrorAlert message={(assignmentQ.error as Error).message} onRetry={() => assignmentQ.refetch()} />
      )}
      {subsQ.isError && (
        <ErrorAlert message={(subsQ.error as Error).message} onRetry={() => subsQ.refetch()} />
      )}

      {filter === 'missing' && (
        <Card>
          <CardHeader
            title={`Missing — ${missing.length}`}
            subtitle="Enrolled students with no submission past the due date."
          />
          {missing.length === 0 ? (
            <EmptyState title="No missing submissions" />
          ) : (
            <ul className="divide-y divide-black/5">
              {missing.map((m) => (
                <li key={m.studentId} className="py-2.5 flex items-center gap-3">
                  <Link
                    to={
                      me?.role === 'faculty'
                        ? `/faculty/students/${m.studentId}`
                        : `/admin/users/${m.studentId}`
                    }
                    className="font-semibold text-brand-navy hover:text-brand-orange"
                  >
                    {m.student?.name ?? m.studentId.slice(-6)}
                  </Link>
                  {m.student?.code && (
                    <span className="font-mono text-xs text-muted">{m.student.code}</span>
                  )}
                  <Badge tone="danger" size="sm">Missing</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {filter !== 'missing' && (
        <ul className="space-y-3">
          {submissions.length === 0 ? (
            <Card>
              <EmptyState title="Nothing here right now" />
            </Card>
          ) : (
            submissions.map((s) => (
              <SubmissionGradeCard
                key={s.id}
                submission={s}
                rubric={rubric}
                maxScore={maxScore}
                courseId={courseId}
                assignmentId={assignmentId}
                selected={selected.has(s.id)}
                onSelectChange={(v) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (v) next.add(s.id);
                    else next.delete(s.id);
                    return next;
                  });
                }}
                showSelect={filter === 'drafts' && s.status === 'graded_draft'}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function SubmissionGradeCard({
  submission,
  rubric,
  maxScore,
  courseId,
  assignmentId,
  selected,
  onSelectChange,
  showSelect,
}: {
  submission: AssignmentSubmissionWithStudent;
  rubric: RubricCriterion[];
  maxScore: number;
  courseId: string;
  assignmentId: string;
  selected: boolean;
  onSelectChange: (v: boolean) => void;
  showSelect: boolean;
}): JSX.Element {
  const qc = useQueryClient();
  const initialRubric = useMemo(() => {
    const m = new Map<number, { score: number; comment: string }>();
    for (const r of submission.rubricScores ?? []) {
      m.set(r.criterionIndex, { score: r.score, comment: r.comment });
    }
    return m;
  }, [submission.rubricScores]);

  const [score, setScore] = useState(submission.score !== null ? String(submission.score) : '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [rubricInputs, setRubricInputs] = useState(() =>
    rubric.map((c, i) => ({
      criterionIndex: i,
      criterionName: c.criterionName,
      weight: c.weight,
      score: initialRubric.get(i)?.score ?? 0,
      comment: initialRubric.get(i)?.comment ?? '',
    })),
  );
  const [open, setOpen] = useState(submission.status === 'graded_draft');
  const [err, setErr] = useState<string | null>(null);

  const draftMut = useMutation({
    mutationFn: () =>
      assignmentsApi.saveDraft(submission.id, {
        score: Number(score),
        feedback: feedback.trim() || undefined,
        rubricScores: rubricInputs.map((r) => ({
          criterionIndex: r.criterionIndex,
          score: r.score,
          comment: r.comment.trim() || undefined,
        })),
      }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ['assignment', assignmentId, 'submissions'] });
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] });
    },
    onError: (e) => setErr((e as Error).message),
  });
  const publishMut = useMutation({
    mutationFn: () => assignmentsApi.publish(submission.id),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ['assignment', assignmentId, 'submissions'] });
      qc.invalidateQueries({ queryKey: ['gradebook', courseId] });
    },
    onError: (e) => setErr((e as Error).message),
  });

  const isDraft = submission.status === 'graded_draft';
  const isPublished = submission.status === 'published';

  return (
    <li className="rounded-2xl bg-white border border-black/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelectChange(e.target.checked)}
                className="accent-brand-orange"
                aria-label="Select for bulk publish"
              />
            )}
            <p className="font-semibold text-brand-navy text-lg">
              {submission.student?.name ?? `Student ${submission.studentId.slice(-6)}`}
            </p>
            {submission.student?.code && (
              <span className="font-mono text-xs text-muted">{submission.student.code}</span>
            )}
            {isDraft && (
              <Badge tone="warning" size="sm">Draft</Badge>
            )}
            {isPublished && (
              <Badge tone="success" size="sm">Published</Badge>
            )}
            {submission.lateFlag && (
              <Badge tone="danger" size="sm">Late</Badge>
            )}
          </div>
          <p className="text-xs text-muted mt-1">
            Submitted {formatIstDateTime(submission.submittedAt)}
            {submission.score !== null && ` · ${submission.score} / ${maxScore}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Collapse' : 'Open'}
        </Button>
      </div>

      {open && (
        <>
          {submission.bodyText && (
            <div className="mt-4 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap text-ink/90 leading-relaxed">
              {submission.bodyText}
            </div>
          )}
          {submission.attachmentUrl && (
            <a
              href={submission.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-brand-navy hover:text-brand-orange font-medium"
            >
              Attachment ↗
            </a>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (score !== '') draftMut.mutate();
            }}
            className="mt-5 space-y-4 border-t border-black/5 pt-4"
          >
            {rubric.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted font-bold">
                  Rubric
                </p>
                {rubricInputs.map((r, i) => (
                  <div
                    key={r.criterionIndex}
                    className="rounded-xl border border-black/10 p-3 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3"
                  >
                    <div>
                      <p className="font-semibold text-sm text-brand-navy">
                        {r.criterionName}{' '}
                        <span className="text-xs text-muted font-normal">({r.weight}%)</span>
                      </p>
                      <Input
                        placeholder="Comment (optional)"
                        value={r.comment}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRubricInputs((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, comment: v } : x)),
                          );
                        }}
                      />
                    </div>
                    <Input
                      label="Score"
                      type="number"
                      min={0}
                      value={String(r.score)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setRubricInputs((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, score: Number.isNaN(v) ? 0 : v } : x)),
                        );
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
              <Input
                label={`Total (of ${maxScore})`}
                type="number"
                min={0}
                max={maxScore}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
              <TextArea
                label="Overall feedback"
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            {err && (
              <div className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                {err}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={draftMut.isPending} disabled={score === ''}>
                Save draft
              </Button>
              <Button
                type="button"
                variant={isDraft ? 'primary' : 'secondary'}
                loading={publishMut.isPending}
                disabled={!isDraft}
                onClick={() => {
                  if (window.confirm('Publish this grade? The student will be notified immediately.')) {
                    publishMut.mutate();
                  }
                }}
              >
                Publish to student
              </Button>
              {!isDraft && !isPublished && (
                <p className="text-xs text-muted">
                  Save a draft first; publishing requires a draft.
                </p>
              )}
              {isPublished && !isDraft && (
                <p className="text-xs text-muted">
                  Edit the grade above and save a new draft to re-publish.
                </p>
              )}
            </div>
          </form>
        </>
      )}
    </li>
  );
}
