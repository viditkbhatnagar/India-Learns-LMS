import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  announcementsApi,
  assignmentsApi,
  meCoursesApi,
  type AssignmentWithMine,
} from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input, TextArea } from '../../components/ui/Input.js';
import { formatIstDateTime } from '../../lib/format.js';

function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <header className="animate-fade-in-up">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          {eyebrow}
        </p>
      )}
      <h1 className="text-display-sm text-brand-navy">{title}</h1>
      {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
    </header>
  );
}

export function StudentCourses() {
  const query = useQuery({
    queryKey: ['me', 'courses'],
    queryFn: meCoursesApi.list,
  });

  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const items = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My learning"
        title="Courses"
        subtitle={`${items.length} active enrolment${items.length === 1 ? '' : 's'}`}
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No courses yet"
            message="Your enrolments will appear here once admin adds you to a batch."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 animate-fade-in-up">
          {items.map((e) => (
            <Link
              key={e.id}
              to={`/student/courses/${e.courseId}`}
              className="group block rounded-2xl overflow-hidden bg-white shadow-elev-1 hover:shadow-elev-3 hover:-translate-y-0.5 transition-all duration-200 ease-decel border border-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 focus-visible:ring-offset-2"
            >
              {/* Top brand strip with course initials. */}
              <div className="relative h-24 bg-brand-gradient overflow-hidden">
                <div className="absolute inset-0 bg-hero-radial opacity-60" />
                <div className="relative h-full flex items-end p-4">
                  <span className="text-white/90 text-xs uppercase tracking-widest font-bold">
                    Course {e.courseId.slice(-6)}
                  </span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
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
                    {e.accessState}
                  </Badge>
                  <Badge tone="info">{e.status}</Badge>
                  {e.completed && <Badge tone="accent">completed</Badge>}
                </div>
                <p className="text-sm text-muted">
                  Valid {new Date(e.validFrom).toLocaleDateString()} –{' '}
                  {new Date(e.validTo).toLocaleDateString()}
                </p>
                <div className="pt-2 text-sm font-semibold text-brand-navy group-hover:text-brand-orange transition-colors">
                  Open course →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const query = useQuery({
    queryKey: ['me', 'courses', courseId],
    queryFn: () => meCoursesApi.get(courseId!),
    enabled: Boolean(courseId),
    // 4xx responses should not trigger retry — they're the canonical "not
    // found / not enrolled / suspended" signals and re-fetching changes
    // nothing.
    retry: (failureCount, err) => {
      if (err instanceof ApiHttpError && err.status >= 400 && err.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
  const annQ = useQuery({
    queryKey: ['course', courseId, 'announcements'],
    queryFn: () => announcementsApi.list(courseId!),
    enabled: Boolean(courseId),
    retry: false,
  });

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) {
    const err = query.error;
    if (err instanceof ApiHttpError) {
      // 404 → course not found / not yet published. 403 → enrolment not active,
      // expired, or fees-suspended. Render a calm empty state rather than
      // the generic red error banner so the student isn't alarmed by what is
      // usually a transient state (admin still finalising the enrolment, etc.).
      if (err.status === 404) {
        return (
          <Card>
            <EmptyState
              title="Course unavailable"
              message="This course isn't open to you right now. If you were expecting access, ask your admin to confirm your enrolment."
              action={<Link to="/student/courses" className="text-brand-orange font-semibold hover:underline">← Back to my courses</Link>}
            />
          </Card>
        );
      }
      if (err.status === 403) {
        return (
          <Card>
            <EmptyState
              title="Access paused"
              message={err.message || 'Your access to this course is paused. Contact Finance or your admin if you believe this is in error.'}
              action={<Link to="/student/courses" className="text-brand-orange font-semibold hover:underline">← Back to my courses</Link>}
            />
          </Card>
        );
      }
    }
    return <ErrorAlert message={(err as Error).message} onRetry={() => query.refetch()} />;
  }
  if (!query.data) return <Skeleton lines={6} />;
  const { course, modules } = query.data;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <Link
          to="/student/courses"
          className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
        >
          ← Back to courses
        </Link>
        <section className="relative mt-3 overflow-hidden rounded-3xl p-6 sm:p-8 bg-brand-gradient text-white shadow-elev-3">
          <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
          <div className="relative">
            <p className="text-white/70 text-xs uppercase tracking-widest font-bold">
              {course.state}
            </p>
            <h1 className="text-display-md mt-2 text-white">{course.name}</h1>
            {course.summary && <p className="mt-3 text-white/80 max-w-2xl">{course.summary}</p>}
          </div>
        </section>
      </div>

      {annQ.data && annQ.data.length > 0 && (
        <Card accent="orange">
          <CardHeader
            title="Announcements"
            subtitle="Latest from your faculty"
          />
          <ul className="space-y-3">
            {annQ.data.slice(0, 5).map((a) => (
              <li key={a.id} className="rounded-xl border border-black/5 bg-surface-muted p-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="font-semibold text-brand-navy">{a.subject}</p>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatIstDateTime(a.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-ink/90 leading-relaxed max-w-[68ch]">{a.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <StudentAssignmentsCard courseId={courseId!} />

      <Card accent="navy">
        <CardHeader
          title="Sessions"
          subtitle={`${modules.length} session${modules.length === 1 ? '' : 's'}`}
        />
        {modules.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            message="The faculty hasn't published content yet. Check back soon."
          />
        ) : (
          <ol className="space-y-2">
            {modules.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/student/courses/${courseId}/modules/${m.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-black/5 bg-white hover:bg-navy-50 hover:border-navy-200 p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30"
                >
                  <span
                    aria-hidden
                    className="shrink-0 h-10 w-10 rounded-xl bg-navy-100 text-brand-navy font-bold font-mono tabular-nums grid place-items-center"
                  >
                    {m.order + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-navy group-hover:text-brand-orange transition-colors truncate">
                      {m.title}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {m.content.length} resource{m.content.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="text-brand-navy/40 group-hover:text-brand-orange group-hover:translate-x-0.5 transition-all"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function StudentModuleView() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const query = useQuery({
    queryKey: ['me', 'courses', courseId],
    queryFn: () => meCoursesApi.get(courseId!),
    enabled: Boolean(courseId),
    retry: (failureCount, err) => {
      if (err instanceof ApiHttpError && err.status >= 400 && err.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) {
    const err = query.error;
    if (err instanceof ApiHttpError && (err.status === 403 || err.status === 404)) {
      return (
        <Card>
          <EmptyState
            title="Session unavailable"
            message={err.status === 404
              ? 'This session may not be published or you may not have access.'
              : (err.message || 'Your access to this course is paused.')}
            action={<Link to="/student/courses" className="text-brand-orange font-semibold hover:underline">← Back to my courses</Link>}
          />
        </Card>
      );
    }
    return <ErrorAlert message={(err as Error).message} onRetry={() => query.refetch()} />;
  }
  if (!query.data) return <Skeleton lines={6} />;
  const module = query.data.modules.find((m) => m.id === moduleId);
  if (!module) {
    return (
      <Card>
        <EmptyState
          title="Session not found"
          message="This session may not be published or you may not have access."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <Link
          to={`/student/courses/${courseId}`}
          className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
        >
          ← Back to course
        </Link>
        <h1 className="text-display-sm text-brand-navy mt-3">{module.title}</h1>
      </div>
      <div className="space-y-4">
        {module.content.map((block) => (
          <Card key={block.id} accent={block.kind === 'quizRef' ? 'orange' : 'none'}>
            <div className="flex items-center gap-2 mb-3">
              <Badge tone={block.kind === 'quizRef' ? 'accent' : 'info'}>{block.kind}</Badge>
              <span className="font-semibold text-brand-navy">{block.title}</span>
            </div>
            {block.kind === 'video' && block.videoUrl && (
              <video controls className="w-full rounded-xl bg-black shadow-elev-1" src={block.videoUrl} />
            )}
            {block.kind === 'pdf' && block.pdfUrl && (
              <a
                href={block.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-navy-50 border border-navy-100 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-navy-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                </svg>
                Open PDF
              </a>
            )}
            {block.kind === 'text' && block.textMarkdown && (
              <div className="prose prose-sm max-w-[68ch] whitespace-pre-wrap text-ink/90 leading-relaxed">
                {block.textMarkdown}
              </div>
            )}
            {block.kind === 'quizRef' && block.quizId && (
              <Link
                to={`/student/quizzes/${block.quizId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-gradient text-white px-5 py-2.5 text-sm font-semibold shadow-elev-1 hover:shadow-glow-orange hover:-translate-y-0.5 transition-all"
              >
                Start quiz →
              </Link>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Student assignments card (embedded in course detail) ----------

function StudentAssignmentsCard({ courseId }: { courseId: string }) {
  const q = useQuery({
    queryKey: ['course', courseId, 'assignments'],
    queryFn: () => assignmentsApi.listForCourse(courseId),
    enabled: Boolean(courseId),
    retry: false,
  });
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return null;
  const items = q.data;

  if (items.length === 0) return null;

  return (
    <Card accent="orange">
      <CardHeader
        title="Assignments"
        subtitle="Submit your work by the due date. Faculty grades and leaves feedback."
      />
      <ul className="space-y-3">
        {items.map((a) => (
          <StudentAssignmentRow key={a.id} a={a} courseId={courseId} />
        ))}
      </ul>
    </Card>
  );
}

function StudentAssignmentRow({ a, courseId }: { a: AssignmentWithMine; courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(a.mySubmission?.bodyText ?? '');
  const [url, setUrl] = useState(a.mySubmission?.attachmentUrl ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      assignmentsApi.submit(a.id, {
        bodyText: body.trim(),
        attachmentUrl: url.trim() ? url.trim() : null,
      }),
    onSuccess: () => {
      setErr(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['course', courseId, 'assignments'] });
    },
    onError: (e) => setErr((e as Error).message),
  });

  const graded = a.mySubmission?.score !== null && a.mySubmission?.score !== undefined;
  const submitted = Boolean(a.mySubmission);
  const overdue = new Date(a.dueAt).getTime() < Date.now();

  return (
    <li className="rounded-xl border border-black/5 bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-brand-navy">{a.title}</p>
            <p className="text-xs text-muted mt-0.5">
              Due {new Date(a.dueAt).toLocaleDateString()}
              {overdue && !submitted ? ' · overdue' : ''} · Max {a.maxScore} pts
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {graded ? (
              <Badge tone="success" dot>
                {a.mySubmission!.score} / {a.maxScore}
              </Badge>
            ) : submitted ? (
              <Badge tone="info" dot>Submitted</Badge>
            ) : overdue ? (
              <Badge tone="danger" dot>Overdue</Badge>
            ) : (
              <Badge tone="warning" dot>Pending</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? 'Close' : submitted ? 'View / edit' : 'Open'}
            </Button>
          </div>
        </div>
        <p className="text-sm whitespace-pre-wrap text-ink/80 mt-2 line-clamp-3">
          {a.instructions}
        </p>
      </div>
      {open && (
        <div className="border-t border-black/5 p-4 bg-surface-muted/60 space-y-3">
          {graded && a.mySubmission?.feedback && (
            <div className="rounded-xl bg-navy-50 border border-navy-100 p-3 text-sm leading-relaxed">
              <p className="font-semibold text-brand-navy mb-1">Faculty feedback</p>
              <p className="whitespace-pre-wrap text-ink/90 max-w-[68ch]">{a.mySubmission.feedback}</p>
            </div>
          )}
          {a.state === 'closed' ? (
            <div className="rounded-xl bg-surface-muted border border-black/5 p-3 text-sm text-muted">
              This assignment is closed — no further submissions accepted.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim() || url.trim()) submit.mutate();
              }}
              className="space-y-3"
            >
              <TextArea
                label="Your response"
                placeholder="Type your answer here…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={16_000}
              />
              <Input
                label="Attachment URL (optional)"
                placeholder="Google Doc, Drive, or any link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
              />
              {err && (
                <div className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                  {err}
                </div>
              )}
              <Button
                type="submit"
                loading={submit.isPending}
                disabled={!body.trim() && !url.trim()}
              >
                {submitted ? 'Resubmit' : 'Submit'}
              </Button>
              {submitted && (
                <p className="text-xs text-muted">
                  Resubmitting will clear your previous grade.
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </li>
  );
}
