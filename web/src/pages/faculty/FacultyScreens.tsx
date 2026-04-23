import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CourseDto,
  ExamAttemptDto,
  FeedbackEntryDto,
  ModuleDto,
  TimetableOccurrenceDto,
} from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { TextArea, Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import {
  announcementsApi,
  assignmentsApi,
  coursesApi,
  facultyApi,
  examsApi,
  feedbackApi,
  modulesApi,
  timetableApi,
  usersApi,
  type AssignmentSubmissionWithStudent,
} from '../../lib/endpoints.js';
import { useAuthStore } from '../../store/auth.js';
import { formatIstDateTime } from '../../lib/format.js';

// ---------- /faculty/courses ----------

export function FacultyCoursesPage() {
  const me = useAuthStore((s) => s.user)!;
  const q = useQuery({ queryKey: ['faculty', 'courses'], queryFn: facultyApi.myCourses });
  const mine = useMemo(
    () => (q.data ?? []).filter((c) => c.facultyIds?.includes(me.id)),
    [q.data, me.id],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">My courses</h1>
        <p className="text-muted text-sm mt-1">
          Courses you're assigned to teach. Open one to manage sessions, post announcements, and review progress.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (mine.length === 0 ? (
            <EmptyState title="No courses assigned" message="Admin will assign you to a course shortly." />
          ) : (
            <ul className="divide-y divide-black/5">
              {mine.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/faculty/courses/${c.id}`} className="font-medium text-brand-navy hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      {c.slug} · v{c.publishedVersion ?? 0}
                    </p>
                  </div>
                  <Badge tone={c.state === 'published' ? 'success' : 'warning'}>{c.state}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /faculty/courses/:id ----------

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

  // Add-module form state.
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

  // Announcement form state.
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

      {/* Announcements */}
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
                  <p className="text-sm whitespace-pre-wrap text-ink/90 leading-relaxed">{a.body}</p>
                </li>
              ))}
            </ul>
          ))}
      </Card>

      {/* Assignments — faculty create + manage */}
      <FacultyAssignmentsCard courseId={id} />

      {/* Sessions (data model calls them Modules; UI calls them Sessions
          to match the stakeholder's mental model). */}
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

// ---------- /faculty/grading ----------

export function FacultyGradingQueuePage() {
  const q = useQuery({ queryKey: ['faculty', 'grading'], queryFn: facultyApi.gradingQueue });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Grading queue</h1>
        <p className="text-muted text-sm mt-1">
          Exam attempts awaiting essay grading from your courses.
        </p>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="Nothing in your queue" message="When students submit essays, they'll appear here." />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link
                      to={`/faculty/grading/${a.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      Attempt {a.id.slice(-6)}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      Student {a.studentId.slice(-6)} · submitted {a.submittedAt ? formatIstDateTime(a.submittedAt) : 'in progress'}
                    </p>
                  </div>
                  <Badge tone="warning">awaiting grade</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- /faculty/grading/:attemptId ----------

interface EssayGrade {
  questionIndex: number;
  score: number;
  comment: string;
}

export function FacultyGradingDetailPage() {
  const { attemptId = '' } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery<ExamAttemptDto>({
    queryKey: ['exam-attempt', attemptId],
    queryFn: () => facultyApi.examAttempt(attemptId),
    enabled: !!attemptId,
  });
  const examQ = useQuery({
    queryKey: ['exam-from-attempt', attemptId],
    queryFn: async () => {
      const a = await facultyApi.examAttempt(attemptId);
      return examsApi.get(a.examId);
    },
    enabled: !!q.data,
  });

  const [grades, setGrades] = useState<EssayGrade[]>([]);
  const submit = useMutation({
    mutationFn: () => examsApi.grade(attemptId, grades),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculty', 'grading'] });
      navigate('/faculty/grading');
    },
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const a = q.data;
  const exam = examQ.data;

  function setGrade(qi: number, patch: Partial<EssayGrade>) {
    setGrades((cur) => {
      const idx = cur.findIndex((g) => g.questionIndex === qi);
      const base: EssayGrade = idx >= 0 ? cur[idx]! : { questionIndex: qi, score: 0, comment: '' };
      const next: EssayGrade = { ...base, ...patch };
      if (idx >= 0) return cur.map((g, i) => (i === idx ? next : g));
      return [...cur, next];
    });
  }
  function gradeFor(qi: number): EssayGrade {
    return grades.find((g) => g.questionIndex === qi) ?? { questionIndex: qi, score: 0, comment: '' };
  }

  const essayQuestions = (exam?.questions ?? [])
    .map((q, qi) => ({ q, qi }))
    .filter(({ q }) => q.kind === 'essay');

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Grade attempt</h1>
        <p className="text-muted text-sm mt-1">
          Student {a.studentId.slice(-6)} · MCQ {a.mcqScorePercent ?? '—'}%
        </p>
      </div>
      {essayQuestions.length === 0 ? (
        <Card>
          <EmptyState title="No essay questions" message="This exam is auto-graded; no manual scoring needed." />
        </Card>
      ) : (
        essayQuestions.map(({ q, qi }) => {
          const ans = a.essayAnswers.find((e) => e.questionIndex === qi);
          const g = gradeFor(qi);
          return (
            <Card key={qi}>
              <CardHeader title={`Q${qi + 1}: ${q.text}`} subtitle={`Worth ${q.points} points`} />
              <div className="bg-brand-cream/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                {ans?.text || <span className="text-muted">No answer.</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <Input
                  label="Score"
                  type="number"
                  min={0}
                  max={q.points}
                  value={g.score}
                  onChange={(e) => setGrade(qi, { score: Number(e.target.value) })}
                />
                <div className="sm:col-span-2">
                  <TextArea
                    label="Comment"
                    rows={3}
                    value={g.comment}
                    onChange={(e) => setGrade(qi, { comment: e.target.value })}
                  />
                </div>
              </div>
            </Card>
          );
        })
      )}
      {essayQuestions.length > 0 && (
        <Card className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Submitting locks this grade and notifies the student.
          </p>
          <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={grades.length === 0}>
            Save grade
          </Button>
        </Card>
      )}
      {submit.isError && <ErrorAlert message={(submit.error as Error).message} />}
    </div>
  );
}

// ---------- /faculty/feedback ----------

export function FacultyFeedbackPage() {
  const q = useQuery({ queryKey: ['faculty', 'feedback'], queryFn: facultyApi.listFeedback });
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">Feedback</h1>
          <p className="text-muted text-sm mt-1">
            Drafts and published responses. Students see only published items.
          </p>
        </div>
        <Link to="/faculty/feedback/new">
          <Button>New feedback</Button>
        </Link>
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState
              title="No feedback yet"
              message="Use New feedback to write your first rubric + summary."
              action={
                <Link to="/faculty/feedback/new">
                  <Button>Write feedback</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((f) => (
                <FeedbackRow key={f.id} f={f} />
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

function FeedbackRow({ f }: { f: FeedbackEntryDto }) {
  const qc = useQueryClient();
  const publish = useMutation({
    mutationFn: () => feedbackApi.publish(f.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faculty', 'feedback'] }),
  });
  return (
    <li className="py-3 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-brand-navy">
          {f.level} · student {f.studentId.slice(-6)}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {f.summary?.slice(0, 90) || 'No summary'}…
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={f.status === 'published' ? 'success' : 'warning'}>{f.status}</Badge>
        {f.status === 'draft' && (
          <Button size="sm" loading={publish.isPending} onClick={() => publish.mutate()}>
            Publish
          </Button>
        )}
      </div>
    </li>
  );
}

// ---------- /faculty/feedback/new ----------

export function FacultyFeedbackNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [level, setLevel] = useState<'course' | 'module' | 'assignment' | 'assessment'>('module');
  const [summary, setSummary] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  const studentsQ = useQuery({
    queryKey: ['users', 'students-for-feedback'],
    queryFn: () => usersApi.list({ role: 'student' }),
  });
  const coursesQ = useQuery({ queryKey: ['faculty', 'courses'], queryFn: facultyApi.myCourses });

  const create = useMutation({
    mutationFn: () =>
      feedbackApi.create({
        studentId,
        courseId,
        moduleId: moduleId || null,
        level,
        summary,
        comments,
        status: 'draft',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faculty', 'feedback'] });
      navigate('/faculty/feedback');
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId) return setError('Pick a student.');
    if (!courseId) return setError('Pick a course.');
    if (summary.length < 10) return setError('Summary must be at least 10 characters.');
    create.mutate();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-display-sm text-brand-navy tracking-tight">New feedback</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Student</span>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(studentsQ.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Course</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(coursesQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Level</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
            >
              <option value="course">Course</option>
              <option value="module">Module</option>
              <option value="assignment">Assignment</option>
              <option value="assessment">Assessment</option>
            </select>
          </label>
          {level === 'module' && (
            <Input
              label="Module ID (optional)"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              hint="Leave empty for course-level feedback."
            />
          )}
          <TextArea
            label="Summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            required
          />
          <TextArea
            label="Detailed feedback"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={6}
          />
          {error && <ErrorAlert message={error} />}
          {create.isError && <ErrorAlert message={(create.error as Error).message} />}
          <div className="flex justify-end">
            <Button type="submit" loading={create.isPending}>Save draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------- /faculty/timetable ----------

function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function FacultyTimetablePage() {
  const [week, setWeek] = useState(() => isoWeekString(new Date()));
  const q = useQuery({
    queryKey: ['faculty', 'timetable', week],
    queryFn: () => timetableApi.mine({ week }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-brand-navy tracking-tight">My timetable</h1>
          <p className="text-muted text-sm mt-1">Read-only view of your assigned classes.</p>
        </div>
        <Input
          type="week"
          label="Week"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="w-44"
        />
      </div>
      <Card>
        {q.isLoading && <Skeleton lines={4} />}
        {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No classes this week" />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((occ: TimetableOccurrenceDto) => (
                <li key={(occ.entryId ?? occ.overrideId ?? '') + occ.startAt} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-brand-navy">{occ.courseName}</p>
                    <p className="text-xs text-muted">
                      {formatIstDateTime(occ.startAt, 'EEE d MMM, h:mm a')} · {occ.room || 'TBA'}
                    </p>
                  </div>
                  {occ.isOverride && <Badge tone="warning">override</Badge>}
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}

// ---------- Faculty assignments card (embedded in course detail) ----------

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
                    <p className="text-sm whitespace-pre-wrap text-ink/80 mt-2 line-clamp-3">
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
        <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap text-ink/90 leading-relaxed">
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
        <div className="mt-3 rounded-lg bg-navy-50 border border-navy-100 p-3 text-sm text-ink/90 leading-relaxed">
          <span className="font-semibold text-brand-navy">Feedback: </span>
          {s.feedback}
        </div>
      )}
    </li>
  );
}
