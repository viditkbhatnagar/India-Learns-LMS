import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { meCoursesApi } from '../../lib/endpoints.js';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { Badge } from '../../components/ui/Badge.js';

export function StudentCourses() {
  const query = useQuery({
    queryKey: ['me', 'courses'],
    queryFn: meCoursesApi.list,
  });

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">My courses</h1>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="No courses yet"
            message="Your enrolments will appear here once admin adds you to a batch."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((e) => (
            <Card key={e.id}>
              <CardHeader
                title={`Course ${e.courseId.slice(-6)}`}
                subtitle={`Valid ${new Date(e.validFrom).toLocaleDateString()} – ${new Date(e.validTo).toLocaleDateString()}`}
              />
              <div className="flex items-center gap-2 mb-3">
                <Badge tone={e.accessState === 'active' ? 'success' : 'warning'}>
                  {e.accessState}
                </Badge>
                <Badge tone="info">{e.status}</Badge>
              </div>
              <Link
                to={`/student/courses/${e.courseId}`}
                className="inline-flex text-sm font-medium text-brand-orange hover:underline"
              >
                Open course →
              </Link>
            </Card>
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
  });

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const { course, modules } = query.data!;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/student/courses" className="text-sm text-brand-orange hover:underline">← Back to courses</Link>
        <h1 className="text-2xl font-bold text-brand-navy mt-2">{course.name}</h1>
        {course.summary && <p className="text-muted mt-1">{course.summary}</p>}
      </div>
      <Card>
        <CardHeader title="Modules" subtitle={`${modules.length} module${modules.length === 1 ? '' : 's'}`} />
        {modules.length === 0 ? (
          <EmptyState title="No modules yet" message="The faculty hasn't published content yet. Check back soon." />
        ) : (
          <ul className="divide-y divide-black/5">
            {modules.map((m) => (
              <li key={m.id} className="py-3">
                <Link to={`/student/courses/${courseId}/modules/${m.id}`} className="font-medium text-brand-navy hover:underline">
                  {m.order + 1}. {m.title}
                </Link>
                <p className="text-xs text-muted mt-0.5">{m.content.length} resource{m.content.length === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
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
  });
  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const module = query.data!.modules.find((m) => m.id === moduleId);
  if (!module) {
    return (
      <EmptyState
        title="Module not found"
        message="This module may not be published or you may not have access."
      />
    );
  }
  return (
    <div className="space-y-4">
      <Link to={`/student/courses/${courseId}`} className="text-sm text-brand-orange hover:underline">← Back to course</Link>
      <h1 className="text-2xl font-bold text-brand-navy">{module.title}</h1>
      <div className="space-y-3">
        {module.content.map((block) => (
          <Card key={block.id}>
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="info">{block.kind}</Badge>
              <span className="font-medium">{block.title}</span>
            </div>
            {block.kind === 'video' && block.videoUrl && (
              <video controls className="w-full rounded-lg bg-black" src={block.videoUrl} />
            )}
            {block.kind === 'pdf' && block.pdfUrl && (
              <a href={block.pdfUrl} target="_blank" rel="noreferrer" className="text-brand-orange hover:underline">
                Open PDF
              </a>
            )}
            {block.kind === 'text' && block.textMarkdown && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">{block.textMarkdown}</div>
            )}
            {block.kind === 'quizRef' && block.quizId && (
              <Link to={`/student/quizzes/${block.quizId}`} className="text-brand-orange hover:underline">
                Start quiz
              </Link>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
