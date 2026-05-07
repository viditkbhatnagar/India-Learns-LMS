import { useMemo, useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignmentStatus,
  StudentAssignmentDto,
  StudentCourseViewDto,
  StudentModuleDto,
  StudentSessionDto,
  StudentSessionState,
} from 'india-learns-shared-types';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Input, TextArea } from '../../../components/ui/Input.js';
import { Skeleton, RequestErrorState } from '../../../components/ui/States.js';
import { assignmentsApi, meCoursesApi } from '../../../lib/endpoints.js';
import { ApiHttpError } from '../../../lib/api.js';

/**
 * PR #16 Phase 5 — student "your course" page rebuild.
 *
 * One call to /v1/me/courses/:courseId/student-view returns the full
 * Module → Session → Assignment tree with status + progress rollups.
 * The page renders four areas:
 *
 *   1. CourseHeader — eyebrow (state), title, collapsible description.
 *   2. ProgressStrip + ModuleJourney — % complete, current module,
 *      and a horizontal "you are here" stepper.
 *   3. StatusCardsRow + NeedsAttentionPanel — late / due-soon / upcoming
 *      counts and the top action items pre-sorted by the API.
 *   4. ModuleList — every module rendered with its session cards (no
 *      expand/collapse — the entire tree is visible). Each session card
 *      links to the existing session detail page; assignment rows link
 *      to the existing assignment-detail route.
 *
 * Uses the existing brand tokens (brand-navy / brand-orange / amber /
 * surface-muted) so this view doesn't drift from the faculty side.
 */
export function StudentCoursePage(): JSX.Element {
  const { courseId } = useParams<{ courseId: string }>();
  const q = useQuery({
    queryKey: ['student-view', courseId],
    queryFn: () => meCoursesApi.studentView(courseId!),
    enabled: Boolean(courseId),
    retry: (failureCount, err) => {
      if (err instanceof ApiHttpError && err.status >= 400 && err.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });

  if (q.isLoading) return <CoursePageSkeleton />;
  if (q.isError) {
    return (
      <Card>
        <RequestErrorState
          error={q.error}
          onRetry={() => q.refetch()}
          action={<Link to="/student/courses" className="text-brand-orange font-semibold hover:underline">← Back to my courses</Link>}
        />
      </Card>
    );
  }
  if (!q.data) return <CoursePageSkeleton />;
  const { data } = q;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/student/courses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
      >
        ← Back to my courses
      </Link>

      <CourseHeader course={data.course} />
      <ProgressStrip data={data} />
      {data.modules.length > 0 && (
        <ModuleJourney modules={data.modules} percentComplete={data.progress.percentComplete} />
      )}
      <StatusCardsRow counts={data.counts} />
      {data.needsAttention.length > 0 && (
        <NeedsAttentionPanel items={data.needsAttention} />
      )}

      <SectionHead
        title="Course content"
        meta={`${data.modules.length} module${data.modules.length === 1 ? '' : 's'}
          · ${countSessions(data.modules)} session${countSessions(data.modules) === 1 ? '' : 's'}
          · ${data.progress.totalAssignments} assignment${data.progress.totalAssignments === 1 ? '' : 's'}`}
      />
      {data.modules.length === 0 ? (
        <Card>
          <p className="text-sm italic text-muted">
            No modules yet — your faculty will publish content here as the cohort starts.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {data.modules.map((m) => (
            <ModuleSection key={m.id} module={m} courseId={data.course.id} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Course header ----------

function CourseHeader({ course }: { course: StudentCourseViewDto['course'] }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const sentences = course.description.match(/[^.!?]+[.!?]+/g) ?? [course.description];
  const preview = sentences.slice(0, 2).join(' ').trim();
  const hasMore = sentences.length > 2 && course.description.length > preview.length;
  const display = expanded || !hasMore ? course.description : preview;

  return (
    <section className="animate-fade-in-up">
      <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
        {course.state}
      </p>
      <h1 className="text-display-md text-brand-navy tracking-tight">
        {course.title}
      </h1>
      {course.description ? (
        <div className="mt-3 max-w-[68ch]">
          <p className="text-base leading-relaxed text-ink/85 whitespace-pre-wrap">
            {display}
          </p>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange inline-flex items-center gap-1"
            >
              {expanded ? 'Show less' : 'Read more'}
              <span aria-hidden className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>↓</span>
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ---------- Progress strip ----------

function ProgressStrip({ data }: { data: StudentCourseViewDto }): JSX.Element {
  return (
    <section className="rounded-2xl border border-black/5 bg-white shadow-elev-1 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted font-bold">Course progress</p>
          <p className="text-display-sm text-brand-navy mt-1 tabular-nums">
            {data.progress.percentComplete}%
          </p>
          <p className="text-xs text-muted mt-1">
            {data.progress.completedAssignments} of {data.progress.totalAssignments} assignment{data.progress.totalAssignments === 1 ? '' : 's'} complete
          </p>
        </div>
        {data.progress.currentModuleTitle && (
          <div className="text-sm text-ink/85">
            <span className="text-xs uppercase tracking-wider text-muted font-bold mr-2">
              Currently in
            </span>
            <span className="font-semibold text-brand-navy">
              Module {data.progress.currentModuleOrder + 1} · {data.progress.currentModuleTitle}
            </span>
          </div>
        )}
      </div>
      <div className="mt-4 h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full bg-brand-orange transition-all duration-500"
          style={{ width: `${data.progress.percentComplete}%` }}
          aria-hidden
        />
      </div>
    </section>
  );
}

// ---------- Module journey stepper ----------

function ModuleJourney({
  modules,
  percentComplete,
}: {
  modules: StudentModuleDto[];
  percentComplete: number;
}): JSX.Element {
  const totalCols = modules.length;
  return (
    <section
      aria-label="Module journey"
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-elev-1 overflow-x-auto"
    >
      <p className="text-xs uppercase tracking-wider text-muted font-bold mb-4">Your journey</p>
      <div className="relative min-w-[420px]">
        <div className="absolute top-[18px] left-5 right-5 h-0.5 bg-surface-muted rounded-full" />
        <div
          className="absolute top-[18px] left-5 h-0.5 bg-brand-orange rounded-full transition-all duration-500"
          style={{ width: `calc(${percentComplete}% - 0px)` }}
        />
        <div
          className="grid relative z-10 gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, totalCols)}, minmax(80px, 1fr))` }}
        >
          {modules.map((m) => (
            <ModuleNode key={m.id} module={m} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleNode({ module: m }: { module: StudentModuleDto }): JSX.Element {
  const isCurrent = m.state === 'in_progress';
  const isComplete = m.state === 'complete';
  return (
    <a
      href={`#module-${m.id}`}
      className="group flex flex-col items-center gap-2 hover:-translate-y-0.5 transition-transform"
    >
      <div
        className={[
          'h-9 w-9 rounded-full grid place-items-center font-semibold text-sm transition-all',
          isComplete
            ? 'bg-success text-white'
            : isCurrent
              ? 'bg-white border-2 border-brand-orange text-brand-orange ring-4 ring-brand-orange/20'
              : 'bg-white border-[1.5px] border-black/10 text-muted',
        ].join(' ')}
      >
        {isComplete ? '✓' : m.order + 1}
      </div>
      <span
        className={`text-[10px] tracking-[0.1em] uppercase font-semibold
          ${isCurrent ? 'text-brand-orange' : 'text-muted'}`}
      >
        {isCurrent ? 'You are here' : 'Module'}
      </span>
      <span
        className={`text-xs text-center leading-tight max-w-[100px] line-clamp-2
          ${isCurrent ? 'font-semibold text-brand-navy' : 'text-muted'}`}
      >
        {m.title}
      </span>
      {(isCurrent || isComplete) && (
        <span className={`text-[11px] font-semibold tabular-nums ${isCurrent ? 'text-brand-orange' : 'text-success'}`}>
          {m.progress.completed}/{m.progress.total}
        </span>
      )}
    </a>
  );
}

// ---------- Status cards row ----------

function StatusCardsRow({
  counts,
}: {
  counts: StudentCourseViewDto['counts'];
}): JSX.Element {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusCard label="Late" value={counts.late} tone={counts.late > 0 ? 'danger' : 'neutral'} />
      <StatusCard label="Due soon" value={counts.dueSoon} tone={counts.dueSoon > 0 ? 'warning' : 'neutral'} />
      <StatusCard label="Upcoming" value={counts.upcoming} tone="neutral" />
    </section>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'neutral';
}): JSX.Element {
  const ring =
    tone === 'danger'
      ? 'border-danger/30 bg-red-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-black/5 bg-white';
  const num = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-amber-800' : 'text-brand-navy';
  return (
    <div className={`rounded-2xl border ${ring} p-4`}>
      <p className="text-xs uppercase tracking-wider text-muted font-bold">{label}</p>
      <p className={`text-3xl font-bold tabular-nums mt-1 ${num}`}>{value}</p>
    </div>
  );
}

// ---------- Needs attention panel ----------

function NeedsAttentionPanel({
  items,
}: {
  items: StudentAssignmentDto[];
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="text-xs uppercase tracking-wider text-amber-800 font-bold">Needs your attention</p>
      <p className="text-sm text-ink/85 mt-1">
        {items.length} assignment{items.length === 1 ? '' : 's'} you should look at next.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById(`assignment-${a.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 hover:border-amber-300 hover:bg-amber-50 transition-colors"
            >
              <StatusIcon status={a.status} />
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-brand-navy truncate">{a.title}</span>
                <span className="block text-xs text-muted">
                  {a.status === 'late'
                    ? `Was due ${formatShortDate(a.dueAt)}`
                    : `Due ${formatShortDate(a.dueAt)}`}
                </span>
              </span>
              <DuePill status={a.status} daysUntilDue={a.daysUntilDue} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Module section ----------

function ModuleSection({
  module: m,
  courseId,
}: {
  module: StudentModuleDto;
  courseId: string;
}): JSX.Element {
  const isCurrent = m.state === 'in_progress';
  const stateLabel =
    m.state === 'complete' ? 'Complete' : m.state === 'in_progress' ? 'In progress' : 'Not started';

  return (
    <section
      id={`module-${m.id}`}
      className={`relative pl-${isCurrent ? '4' : '0'}`}
    >
      {isCurrent && (
        <span aria-hidden className="absolute -left-1 top-2 bottom-0 w-[3px] bg-brand-orange/30 rounded" />
      )}
      <header className="flex items-end justify-between gap-4 pb-3 mb-3 border-b border-black/5">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] font-bold
              ${isCurrent ? 'text-brand-orange' : 'text-muted'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-brand-orange ring-2 ring-brand-orange/30' : 'bg-black/15'}`}
            />
            Module {m.order + 1} · {stateLabel}
          </p>
          <h3 className="text-display-sm text-brand-navy tracking-tight mt-1">{m.title}</h3>
          {m.aim && (
            <p className="text-sm text-ink/80 mt-1.5 max-w-[68ch] leading-relaxed">{m.aim}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold tabular-nums ${isCurrent ? 'text-brand-orange' : 'text-muted'}`}>
            {m.progress.completed} / {m.progress.total}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold mt-0.5">Assignments</p>
        </div>
      </header>
      {m.sessions.length === 0 ? (
        <p className="text-sm italic text-muted py-3">No sessions in this module yet.</p>
      ) : (
        <div className="space-y-3">
          {m.sessions.map((s) => (
            <SessionCard key={s.id} session={s} courseId={courseId} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Session card ----------

function SessionCard({
  session: s,
  courseId,
}: {
  session: StudentSessionDto;
  courseId: string;
}): JSX.Element {
  const isCurrent = s.state === 'in_progress';
  const isComplete = s.state === 'complete';

  return (
    <article
      id={`session-${s.id}`}
      className={[
        'rounded-2xl bg-white border transition-colors overflow-hidden',
        isCurrent ? 'border-brand-orange/60 shadow-elev-1' : 'border-black/5 hover:border-black/10',
      ].join(' ')}
    >
      <Link
        to={`/student/courses/${courseId}/sessions/${s.id}`}
        className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted/40 transition-colors group"
      >
        <SessionNumber order={s.order} state={s.state} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-brand-navy truncate group-hover:text-brand-orange transition-colors">
            {s.title}
          </div>
          <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isCurrent ? 'bg-brand-orange' : isComplete ? 'bg-success' : 'bg-black/20'
              }`}
            />
            {sessionStateLabel(s.state)}
            {s.subtitle && <span className="truncate">· {s.subtitle}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-sm font-semibold tabular-nums ${isCurrent ? 'text-brand-orange' : 'text-brand-navy'}`}>
            {s.progress.completed} / {s.progress.total}
          </span>
          <ProgressSegments assignments={s.assignments} />
        </div>
        <span aria-hidden className="text-muted/60 group-hover:text-brand-orange transition-colors">
          →
        </span>
      </Link>
      {s.assignments.length > 0 && (
        <div className="border-t border-black/5 bg-surface-muted/40">
          <p className="px-5 pt-2 pb-1 text-[10px] uppercase tracking-[0.08em] font-bold text-muted">
            Assignments · {s.assignments.length}
          </p>
          <ul>
            {s.assignments.map((a) => (
              <li key={a.id}>
                <AssignmentRow assignment={a} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

// ---------- Assignment row ----------

function AssignmentRow({ assignment: a }: { assignment: StudentAssignmentDto }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div id={`assignment-${a.id}`} className="border-t border-black/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white transition-colors text-left"
      >
        <StatusIcon status={a.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-brand-navy truncate">{a.title}</div>
          <div className={`text-xs ${metaColor(a.status)} mt-0.5`}>{metaLine(a)}</div>
        </div>
        {a.status === 'graded' && a.score !== null ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 tabular-nums shrink-0">
            {a.score} / {a.maxPoints}
          </span>
        ) : (
          <DuePill status={a.status} daysUntilDue={a.daysUntilDue} />
        )}
        <span aria-hidden className={`text-muted/60 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && <AssignmentSubmitPanel assignment={a} />}
    </div>
  );
}

/**
 * Inline submit panel — replaces the legacy `StudentAssignmentRow` from
 * `StudentCourses.tsx`. Loads the full assignment + my submission via
 * `assignmentsApi.get` so we have feedback / instructions / etc., then
 * delegates submission to `assignmentsApi.submit`. Keeps the new course
 * page self-contained without introducing a new student-side route.
 */
function AssignmentSubmitPanel({ assignment }: { assignment: StudentAssignmentDto }): JSX.Element {
  const qc = useQueryClient();
  const detailQ = useQuery({
    queryKey: ['student-assignment', assignment.id],
    queryFn: () => assignmentsApi.get(assignment.id),
    retry: false,
  });
  const [bodyText, setBodyText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [seeded, setSeeded] = useState(false);
  const submitMut = useMutation({
    mutationFn: () =>
      assignmentsApi.submit(assignment.id, {
        bodyText: bodyText.trim(),
        attachmentUrl: attachmentUrl.trim() ? attachmentUrl.trim() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-assignment', assignment.id] });
      qc.invalidateQueries({ queryKey: ['student-view'] });
    },
  });

  // Seed the form from the existing submission once detail loads.
  if (detailQ.data && !seeded) {
    setBodyText(detailQ.data.mySubmission?.bodyText ?? '');
    setAttachmentUrl(detailQ.data.mySubmission?.attachmentUrl ?? '');
    setSeeded(true);
  }

  if (detailQ.isLoading) return <div className="px-5 pb-4"><Skeleton lines={3} /></div>;
  if (detailQ.isError || !detailQ.data) {
    return (
      <div className="px-5 pb-4 text-xs text-danger">
        Could not load this assignment. {detailQ.error instanceof Error ? detailQ.error.message : ''}
      </div>
    );
  }

  const detail = detailQ.data;
  const isClosed = detail.assignment.state === 'closed';
  const submitted = Boolean(detail.mySubmission);
  const submitErr = submitMut.error instanceof Error ? submitMut.error.message : null;

  return (
    <div className="px-5 pb-4 bg-white border-t border-black/5">
      {detail.assignment.instructions && (
        <p className="text-sm text-ink/85 mt-3 whitespace-pre-wrap leading-relaxed max-w-[68ch]">
          {detail.assignment.instructions}
        </p>
      )}
      {assignment.status === 'graded' && assignment.feedback && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-semibold text-green-900 mb-1">Faculty feedback</p>
          <p className="whitespace-pre-wrap text-ink/90 max-w-[68ch]">{assignment.feedback}</p>
        </div>
      )}
      {isClosed ? (
        <div className="mt-3 rounded-xl border border-black/10 bg-surface-muted p-3 text-sm text-muted">
          This assignment is closed — no further submissions accepted.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (bodyText.trim() || attachmentUrl.trim()) submitMut.mutate();
          }}
          className="mt-3 space-y-3"
        >
          <TextArea
            label="Your response"
            placeholder="Type your answer here…"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={5}
            maxLength={16_000}
          />
          <Input
            label="Attachment URL (optional)"
            placeholder="Google Doc, Drive, or any link"
            value={attachmentUrl}
            onChange={(e) => setAttachmentUrl(e.target.value)}
            type="url"
          />
          {submitErr && (
            <div className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {submitErr}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              loading={submitMut.isPending}
              disabled={!bodyText.trim() && !attachmentUrl.trim()}
            >
              {submitted ? 'Resubmit' : 'Submit'}
            </Button>
            {submitted && (
              <p className="text-xs text-muted">Resubmitting clears your previous grade.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- Helpers + bits ----------

function SectionHead({ title, meta }: { title: string; meta: string }): JSX.Element {
  return (
    <header className="flex items-end justify-between gap-3 mt-4">
      <h2 className="text-display-sm text-brand-navy tracking-tight">{title}</h2>
      <p className="text-xs text-muted whitespace-nowrap">{meta}</p>
    </header>
  );
}

function CoursePageSkeleton(): JSX.Element {
  return (
    <div className="space-y-6 max-w-5xl">
      <Skeleton lines={2} />
      <Skeleton variant="card" />
      <Skeleton lines={3} />
      <Skeleton variant="card" />
    </div>
  );
}

function SessionNumber({ order, state }: { order: number; state: StudentSessionState }): JSX.Element {
  const tone =
    state === 'complete'
      ? 'bg-success text-white border-success'
      : state === 'in_progress'
        ? 'bg-white text-brand-orange border-brand-orange'
        : 'bg-white text-muted border-black/10';
  return (
    <span
      aria-hidden
      className={`shrink-0 h-10 w-10 rounded-xl border-[1.5px] grid place-items-center font-mono text-sm font-bold tabular-nums ${tone}`}
    >
      {state === 'complete' ? '✓' : String(order + 1).padStart(2, '0')}
    </span>
  );
}

function ProgressSegments({ assignments }: { assignments: StudentAssignmentDto[] }): JSX.Element {
  const total = Math.max(assignments.length, 1);
  const segs = useMemo(
    () =>
      assignments.length === 0
        ? [{ key: 'empty', tone: 'empty' as const }]
        : assignments.map((a) => ({ key: a.id, tone: assignmentTone(a.status) })),
    [assignments],
  );
  return (
    <div className="flex gap-1 w-32 max-w-full" aria-hidden>
      {segs.map((s) => (
        <span
          key={s.key}
          className={[
            'h-1.5 rounded-full flex-1',
            s.tone === 'graded'
              ? 'bg-success'
              : s.tone === 'late'
                ? 'bg-danger'
                : s.tone === 'dueSoon'
                  ? 'bg-amber-500'
                  : s.tone === 'submitted'
                    ? 'bg-brand-navy/60'
                    : 'bg-black/10',
          ].join(' ')}
          style={{ flexBasis: `${100 / total}%` }}
        />
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: AssignmentStatus }): JSX.Element {
  const className =
    status === 'graded'
      ? 'bg-success/10 text-success'
      : status === 'late'
        ? 'bg-danger/10 text-danger'
        : status === 'dueSoon'
          ? 'bg-amber-100 text-amber-800'
          : status === 'submitted'
            ? 'bg-navy-100 text-brand-navy'
            : 'bg-surface-muted text-muted';
  const glyph =
    status === 'graded' ? '✓' : status === 'late' ? '!' : status === 'submitted' ? '↑' : '·';
  return (
    <span
      aria-hidden
      className={`shrink-0 h-7 w-7 rounded-full grid place-items-center text-sm font-bold ${className}`}
    >
      {glyph}
    </span>
  );
}

function DuePill({ status, daysUntilDue }: { status: AssignmentStatus; daysUntilDue: number }): JSX.Element {
  if (status === 'late') {
    const days = Math.abs(daysUntilDue);
    return (
      <Badge tone="danger" size="sm">
        {days === 0 ? 'Late' : `${days}d late`}
      </Badge>
    );
  }
  if (status === 'dueSoon') {
    return (
      <Badge tone="warning" size="sm">
        {daysUntilDue === 0 ? 'Due today' : `${daysUntilDue}d`}
      </Badge>
    );
  }
  if (status === 'submitted') {
    return <Badge tone="info" size="sm">Submitted</Badge>;
  }
  return (
    <span className="text-xs text-muted whitespace-nowrap">in {daysUntilDue}d</span>
  );
}

function assignmentTone(status: AssignmentStatus): 'graded' | 'late' | 'dueSoon' | 'submitted' | 'upcoming' {
  if (status === 'graded') return 'graded';
  if (status === 'late') return 'late';
  if (status === 'dueSoon') return 'dueSoon';
  if (status === 'submitted') return 'submitted';
  return 'upcoming';
}

function sessionStateLabel(state: StudentSessionState): string {
  if (state === 'complete') return 'Complete';
  if (state === 'in_progress') return 'In progress';
  return 'Not started';
}

function countSessions(modules: StudentModuleDto[]): number {
  return modules.reduce((sum, m) => sum + m.sessions.length, 0);
}

function metaLine(a: StudentAssignmentDto): string {
  if (a.status === 'graded') return 'Graded · feedback available';
  if (a.status === 'submitted') return 'Submitted · awaiting grade';
  if (a.status === 'late') return `Was due ${formatShortDate(a.dueAt)}`;
  return `Due ${formatShortDate(a.dueAt)}`;
}

function metaColor(status: AssignmentStatus): string {
  if (status === 'late') return 'text-danger/80';
  if (status === 'dueSoon') return 'text-amber-700';
  if (status === 'graded') return 'text-success';
  return 'text-muted';
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

