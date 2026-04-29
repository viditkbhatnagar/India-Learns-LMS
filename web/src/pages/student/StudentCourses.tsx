import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { meCoursesApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState, RequestErrorState } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';

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

/**
 * The student "my courses" landing list. Detail view lives at
 * `/student/courses/:courseId` and is rendered by `StudentCoursePage`
 * (course-view/StudentCoursePage.tsx) since the PR #16 visual rebuild.
 */
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
              <div className="relative h-24 bg-brand-gradient overflow-hidden">
                <div className="absolute inset-0 bg-hero-radial opacity-60" />
                <div className="relative h-full flex items-end p-4">
                  <span
                    className="text-white text-base font-semibold leading-tight line-clamp-2"
                    title={e.course?.name ?? `Course ${e.courseId.slice(-6)}`}
                  >
                    {e.course?.name ?? `Course ${e.courseId.slice(-6)}`}
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
                  {e.course?.slug && (
                    <span className="font-mono text-xs text-muted">{e.course.slug}</span>
                  )}
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

/**
 * Legacy module deep-link (`/student/courses/:id/modules/:moduleId`)
 * still routes here so old "Start quiz" links from outside the
 * shell (e.g. notification emails) keep working. The new student
 * course page renders the same content inline.
 */
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
    return (
      <Card>
        <RequestErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          title="Session unavailable"
          action={<Link to="/student/courses" className="text-brand-orange font-semibold hover:underline">← Back to my courses</Link>}
        />
      </Card>
    );
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
