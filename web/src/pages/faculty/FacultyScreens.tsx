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
import { coursesApi, facultyApi, examsApi, feedbackApi, timetableApi, usersApi } from '../../lib/endpoints.js';
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
        <h1 className="text-2xl font-bold text-brand-navy">My courses</h1>
        <p className="text-muted text-sm mt-1">
          Courses you're assigned to teach. Open one to manage modules and review progress.
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
  const q = useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.get(id),
    enabled: !!id,
  });
  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError) return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  const { course, modules } = q.data as { course: CourseDto; modules: ModuleDto[] };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">{course.name}</h1>
          <p className="text-muted text-sm mt-1">
            <Badge tone={course.state === 'published' ? 'success' : 'warning'}>{course.state}</Badge>
            <span className="ml-3 font-mono text-xs">{course.slug}</span>
          </p>
        </div>
      </div>
      <Card>
        <CardHeader title="Modules" subtitle={`${modules.length} module${modules.length === 1 ? '' : 's'}`} />
        {modules.length === 0 ? (
          <EmptyState title="No modules yet" message="Admin must add modules to this course." />
        ) : (
          <ol className="space-y-2">
            {modules.map((m) => (
              <li key={m.id} className="flex items-center justify-between border border-black/5 rounded-lg p-3">
                <div>
                  <p className="font-medium text-brand-navy">{m.title}</p>
                  <p className="text-xs text-muted">{m.content?.length ?? 0} content items</p>
                </div>
                <Badge tone="neutral">order {m.order}</Badge>
              </li>
            ))}
          </ol>
        )}
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
        <h1 className="text-2xl font-bold text-brand-navy">Grading queue</h1>
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
        <h1 className="text-2xl font-bold text-brand-navy">Grade attempt</h1>
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
          <h1 className="text-2xl font-bold text-brand-navy">Feedback</h1>
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
      <h1 className="text-2xl font-bold text-brand-navy">New feedback</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Student</span>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
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
              className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
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
              className="w-full h-10 px-3 rounded-lg border border-black/10 bg-white"
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
          <h1 className="text-2xl font-bold text-brand-navy">My timetable</h1>
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
