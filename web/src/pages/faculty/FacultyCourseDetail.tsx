import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CourseDto, ModuleDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { TextArea, Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import {
  announcementsApi,
  assignmentsApi,
  coursesApi,
  modulesApi,
  type AssignmentSubmissionWithStudent,
} from '../../lib/endpoints.js';
import { formatIstDateTime } from '../../lib/format.js';

export function FacultyCourseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.get(id),
    enabled: !!id,
  });
  const annQ = useQuery({
    queryKey: ['course', id, 'announcements'],
    queryFn: () => announcementsApi.list(id),
    enabled: !!id,
  });

  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleOrder, setNewModuleOrder] = useState('');
  const [moduleErr, setModuleErr] = useState<string | null>(null);
  const addModule = useMutation({
    mutationFn: () =>
      modulesApi.createOnCourse(id, {
        title: newModuleTitle.trim(),
        order: Number(newModuleOrder),
      }),
    onSuccess: () => {
      setNewModuleTitle('');
      setNewModuleOrder('');
      setModuleErr(null);
      qc.invalidateQueries({ queryKey: ['course', id] });
    },
    onError: (err) => setModuleErr((err as Error).message),
  });

  const [annSubject, setAnnSubject] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annErr, setAnnErr] = useState<string | null>(null);
  const postAnn = useMutation({
    mutationFn: () =>
      announcementsApi.create(id, { subject: annSubject.trim(), body: annBody.trim() }),
    onSuccess: () => {
      setAnnSubject('');
      setAnnBody('');
      setAnnErr(null);
      qc.invalidateQueries({ queryKey: ['course', id, 'announcements'] });
    },
    onError: (err) => setAnnErr((err as Error).message),
  });

  if (q.isLoading) return <Skeleton variant="card" />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const { course, modules } = q.data as { course: CourseDto; modules: ModuleDto[] };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">{course.name}</h1>
          <p className="text-muted text-sm mt-1 flex items-center gap-3 flex-wrap">
            <Badge tone={course.state === 'published' ? 'success' : 'warning'} dot>
              {course.state}
            </Badge>
            <span className="font-mono text-xs">{course.slug}</span>
          </p>
        </div>
      </div>

      <Card accent="orange">
        <CardHeader
          title="Announcements"
          subtitle="Broadcast to every enrolled student in this course."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (annSubject.trim() && annBody.trim()) postAnn.mutate();
          }}
          className="space-y-3 mb-5"
        >
          <Input
            label="Subject"
            placeholder="e.g. Quiz 2 rescheduled to Friday"
            value={annSubject}
            onChange={(e) => setAnnSubject(e.target.value)}
            maxLength={240}
          />
          <TextArea
            label="Message"
            placeholder="Full announcement body…"
            value={annBody}
            onChange={(e) => setAnnBody(e.target.value)}
            rows={4}
            maxLength={4000}
          />
          {annErr && (
            <div className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {annErr}
            </div>
          )}
          <Button
            type="submit"
            loading={postAnn.isPending}
            disabled={!annSubject.trim() || !annBody.trim()}
          >
            Post announcement
          </Button>
        </form>
        {annQ.isLoading && <Skeleton lines={3} />}
        {annQ.data &&
          (annQ.data.length === 0 ? (
            <EmptyState title="No announcements yet" message="Your posts will show up here." />
          ) : (
            <ul className="space-y-3">
              {annQ.data.map((a) => (
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
          ))}
      </Card>

      <FacultyAssignmentsCard courseId={id} />

      <Card accent="navy">
        <CardHeader
          title="Sessions"
          subtitle={`${modules.length} session${modules.length === 1 ? '' : 's'}`}
        />
        {modules.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            message="Add your first session below — students will see it once this course is published."
          />
        ) : (
          <ol className="space-y-2 mb-5">
            {modules.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between border border-black/5 rounded-xl p-4 bg-white"
              >
                <div>
                  <p className="font-medium text-brand-navy">{m.title}</p>
                  <p className="text-xs text-muted">
                    {m.content?.length ?? 0} content item{m.content?.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Badge tone="neutral">order {m.order}</Badge>
              </li>
            ))}
          </ol>
        )}
        <div className="border-t border-black/5 pt-5">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-3">
            Add a new session
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newModuleTitle.trim() && newModuleOrder !== '') addModule.mutate();
            }}
            className="grid grid-cols-1 sm:grid-cols-[1fr,120px,auto] gap-3"
          >
            <Input
              label="Title"
              placeholder="Session title"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              maxLength={200}
            />
            <Input
              label="Order"
              type="number"
              min={0}
              value={newModuleOrder}
              onChange={(e) => setNewModuleOrder(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                loading={addModule.isPending}
                disabled={!newModuleTitle.trim() || newModuleOrder === ''}
              >
                Add session
              </Button>
            </div>
          </form>
          {moduleErr && (
            <div className="mt-3 rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {moduleErr}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function FacultyAssignmentsCard({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['course', courseId, 'assignments'],
    queryFn: () => assignmentsApi.listForCourse(courseId),
    enabled: Boolean(courseId),
  });

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const createMut = useMutation({
    mutationFn: () =>
      assignmentsApi.createOnCourse(courseId, {
        title: title.trim(),
        instructions: instructions.trim(),
        dueAt: dueDate
          ? new Date(`${dueDate}T23:59:00Z`).toISOString()
          : new Date(Date.now() + 7 * 86_400_000).toISOString(),
        maxScore: Number(maxScore) || 100,
      }),
    onSuccess: () => {
      setTitle('');
      setInstructions('');
      setDueDate('');
      setMaxScore('100');
      setCreateErr(null);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['course', courseId, 'assignments'] });
    },
    onError: (err) => setCreateErr((err as Error).message),
  });

  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);

  return (
    <Card accent="orange">
      <CardHeader
        title="Assignments"
        subtitle="Create assignments, track submissions, and grade student work."
        action={
          <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New assignment'}
          </Button>
        }
      />
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && instructions.trim()) createMut.mutate();
          }}
          className="space-y-3 mb-5 rounded-xl bg-surface-muted p-4 border border-black/5"
        >
          <Input
            label="Title"
            placeholder="e.g. Assignment 1 — Runway markings"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={240}
          />
          <TextArea
            label="Instructions"
            placeholder="What should students submit? Length? Format?"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            maxLength={8000}
          />
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px] gap-3">
            <Input
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label="Max score"
              type="number"
              min={1}
              max={1000}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </div>
          {createErr && (
            <div className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {createErr}
            </div>
          )}
          <Button
            type="submit"
            loading={createMut.isPending}
            disabled={!title.trim() || !instructions.trim()}
          >
            Publish assignment
          </Button>
        </form>
      )}

      {listQ.isLoading && <Skeleton lines={3} />}
      {listQ.data &&
        (listQ.data.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            message="Click 'New assignment' to post one for enrolled students."
          />
        ) : (
          <ul className="space-y-3">
            {listQ.data.map((a) => (
              <li key={a.id} className="rounded-xl border border-black/5 bg-white overflow-hidden">
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">{a.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      Due {new Date(a.dueAt).toLocaleDateString()} · Max {a.maxScore} pts ·{' '}
                      <Badge tone={a.state === 'open' ? 'info' : 'neutral'} size="sm">
                        {a.state}
                      </Badge>
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-ink/80 mt-2 line-clamp-3 max-w-[68ch]">
                      {a.instructions}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setOpenAssignmentId(openAssignmentId === a.id ? null : a.id)
                    }
                  >
                    {openAssignmentId === a.id ? 'Hide' : 'Submissions'}
                  </Button>
                </div>
                {openAssignmentId === a.id && (
                  <FacultySubmissionsPanel assignmentId={a.id} maxScore={a.maxScore} />
                )}
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

function FacultySubmissionsPanel({
  assignmentId,
  maxScore,
}: {
  assignmentId: string;
  maxScore: number;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['assignment', assignmentId, 'submissions'],
    queryFn: () => assignmentsApi.listSubmissions(assignmentId),
  });

  if (q.isLoading) {
    return (
      <div className="p-4 border-t border-black/5">
        <Skeleton lines={2} />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="p-4 border-t border-black/5">
        <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />
      </div>
    );
  }
  const items = q.data ?? [];

  return (
    <div className="border-t border-black/5 bg-surface-muted/60 p-4 space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted font-bold">
        {items.length} submission{items.length === 1 ? '' : 's'}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">No submissions yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <SubmissionRow
              key={s.id}
              s={s}
              maxScore={maxScore}
              onGraded={() =>
                qc.invalidateQueries({ queryKey: ['assignment', assignmentId, 'submissions'] })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmissionRow({
  s,
  maxScore,
  onGraded,
}: {
  s: AssignmentSubmissionWithStudent;
  maxScore: number;
  onGraded: () => void;
}) {
  const [score, setScore] = useState(s.score !== null ? String(s.score) : '');
  const [feedback, setFeedback] = useState(s.feedback ?? '');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const grade = useMutation({
    mutationFn: () =>
      assignmentsApi.grade(s.id, {
        score: Number(score),
        feedback: feedback.trim() || undefined,
      }),
    onSuccess: () => {
      setEditing(false);
      setErr(null);
      onGraded();
    },
    onError: (e) => setErr((e as Error).message),
  });
  const graded = s.score !== null;

  return (
    <li className="rounded-xl bg-white border border-black/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-brand-navy">
            {s.student?.name ?? `Student ${s.studentId.slice(-6)}`}
            {s.student?.code && (
              <span className="ml-2 font-mono text-xs text-muted">{s.student.code}</span>
            )}
          </p>
          <p className="text-xs text-muted mt-0.5">
            Submitted {formatIstDateTime(s.submittedAt)}
            {graded ? ` · Scored ${s.score} / ${maxScore}` : ' · Not graded'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Close' : graded ? 'Re-grade' : 'Grade'}
        </Button>
      </div>
      {s.bodyText && (
        <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap text-ink/90 leading-relaxed max-w-[68ch]">
          {s.bodyText}
        </div>
      )}
      {s.attachmentUrl && (
        <a
          href={s.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-brand-navy hover:text-brand-orange font-medium"
        >
          Attachment ↗
        </a>
      )}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (score !== '') grade.mutate();
          }}
          className="mt-4 space-y-3 border-t border-black/5 pt-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-3">
            <Input
              label={`Score (of ${maxScore})`}
              type="number"
              min={0}
              max={maxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
            <TextArea
              label="Feedback (optional)"
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
          <Button type="submit" loading={grade.isPending} disabled={score === ''}>
            Save grade
          </Button>
        </form>
      )}
      {graded && !editing && s.feedback && (
        <div className="mt-3 rounded-lg bg-navy-50 border border-navy-100 p-3 text-sm text-ink/90 leading-relaxed max-w-[68ch]">
          <span className="font-semibold text-brand-navy">Feedback: </span>
          {s.feedback}
        </div>
      )}
    </li>
  );
}
