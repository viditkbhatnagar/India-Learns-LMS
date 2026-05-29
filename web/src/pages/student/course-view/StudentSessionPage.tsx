import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { FileLink } from '../../../components/FileLink.js';
import { Input, TextArea } from '../../../components/ui/Input.js';
import {
  RequestErrorState,
  Skeleton,
} from '../../../components/ui/States.js';
import {
  assignmentsApi,
  meCoursesApi,
  type StudentSessionDetail,
} from '../../../lib/endpoints.js';
import { ApiHttpError } from '../../../lib/api.js';
import { asGrid, asLines } from '../../../lib/slideShape.js';

/**
 * UAT round 4 — Logan flagged that students could not click into
 * individual sessions. This page is what the SessionCard on the
 * student course view links to. It renders:
 *
 *   - Session header (title, status, when/where)
 *   - Description (if any)
 *   - Materials list — for slide decks, embeds an inline slide viewer
 *     so students can flip through the deck without bouncing to the
 *     staff-only viewer at /courses/:id/sessions/:sId/materials/:mId
 *   - Assignments — each row carries the same inline submit form the
 *     course-view AssignmentRow uses (title / instructions / due date /
 *     submit + attachment URL).
 *
 * Mounted at /student/courses/:courseId/sessions/:sessionId.
 */
export function StudentSessionPage(): JSX.Element {
  const { courseId = '', sessionId = '' } = useParams<{
    courseId: string;
    sessionId: string;
  }>();

  const q = useQuery({
    queryKey: ['student-session', courseId, sessionId],
    queryFn: () => meCoursesApi.studentSession(courseId, sessionId),
    enabled: Boolean(courseId && sessionId),
    retry: (failureCount, err) => {
      if (err instanceof ApiHttpError && err.status >= 400 && err.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });

  if (q.isLoading) return <Skeleton variant="card" />;
  if (q.isError) {
    return (
      <Card>
        <RequestErrorState
          error={q.error}
          onRetry={() => q.refetch()}
          title="Session unavailable"
          action={
            <Link to={`/student/courses/${courseId}`} className="text-brand-orange font-semibold hover:underline">
              ← Back to course
            </Link>
          }
        />
      </Card>
    );
  }
  if (!q.data) return <Skeleton variant="card" />;
  const { course, session, materials, assignments } = q.data;

  const isCompleted = session.status === 'completed';
  return (
    <div className="space-y-5 max-w-5xl">
      <Link
        to={`/student/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
      >
        ← Back to {course.title}
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Session {session.order + 1}
        </p>
        <h1 className="text-display-md text-brand-navy tracking-tight">{session.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone={isCompleted ? 'success' : session.status === 'in_progress' ? 'warning' : 'neutral'} dot>
            {session.status === 'in_progress' ? 'in progress' : session.status}
          </Badge>
          {session.plannedMinutes && <span className="text-muted">{session.plannedMinutes} min</span>}
          {session.location && <span className="text-muted">· {session.location}</span>}
          {session.scheduledStart && (
            <span className="text-muted">
              · {new Date(session.scheduledStart).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </header>

      {session.description && (
        <Card>
          <CardHeader title="About this session" />
          <p className="text-sm leading-relaxed text-ink/85 whitespace-pre-wrap max-w-[68ch]">
            {session.description}
          </p>
        </Card>
      )}

      {materials.length > 0 && (
        <Card>
          <CardHeader
            title="Materials"
            subtitle={`${materials.length} item${materials.length === 1 ? '' : 's'}`}
          />
          <div className="space-y-3">
            {materials.map((m) => (
              <MaterialItem key={m.id} material={m} />
            ))}
          </div>
        </Card>
      )}

      {assignments.length > 0 && (
        <Card>
          <CardHeader
            title="Assignments"
            subtitle={`${assignments.length} for this session`}
          />
          <ul className="space-y-3">
            {assignments.map((a) => (
              <AssignmentItem key={a.id} assignment={a} />
            ))}
          </ul>
        </Card>
      )}

      {materials.length === 0 && assignments.length === 0 && (
        <Card>
          <p className="text-sm italic text-muted">
            Faculty hasn't attached materials or assignments to this session yet.
          </p>
        </Card>
      )}
    </div>
  );
}

// ---------- Material item (inline slide viewer for type=slides) ----------

function MaterialItem({ material }: { material: StudentSessionDetail['materials'][number] }): JSX.Element {
  const [viewerOpen, setViewerOpen] = useState(false);

  if (material.type === 'slides') {
    return (
      <article className="rounded-2xl border border-black/5 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <Badge tone="info" size="sm">slides</Badge>
          <span className="font-medium text-brand-navy flex-1 truncate">{material.title}</span>
          {material.slideCount && (
            <span className="text-xs text-muted">{material.slideCount} slides</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => setViewerOpen((v) => !v)}>
            {viewerOpen ? 'Close' : 'Open viewer'}
          </Button>
        </div>
        {viewerOpen && (
          <div className="border-t border-black/5">
            <InlineSlideViewer body={material.body} />
          </div>
        )}
      </article>
    );
  }
  // Non-slides: expose the URL. Internal /v1/files links are fetched
  // with auth (FileLink); external URLs open directly. No URL → inert row.
  const rowClass = [
    'flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 transition-colors text-left',
    material.url ? 'hover:bg-surface-muted/40' : 'pointer-events-none opacity-70',
  ].join(' ');
  const rowInner = (
    <>
      <Badge tone="info" size="sm">{material.type}</Badge>
      <span className="font-medium text-brand-navy flex-1 truncate">{material.title}</span>
      {material.url && (
        <span className="text-xs font-medium text-brand-orange whitespace-nowrap">Open ↗</span>
      )}
    </>
  );
  if (!material.url) {
    return <div className={rowClass}>{rowInner}</div>;
  }
  return (
    <FileLink url={material.url} className={rowClass}>
      {rowInner}
    </FileLink>
  );
}

// Lightweight, student-safe slide viewer. Renders the same shapes the
// staff SlideViewer does (title / bullets / two_column / table), but
// without the speaker-notes toggle — students should never see them,
// and the API never returns them in this payload regardless.
interface Slide {
  slideNumber: number;
  slideType: string;
  title?: string | null;
  content: { type?: string; [k: string]: unknown };
}

function InlineSlideViewer({ body }: { body: unknown }): JSX.Element {
  const slides = useMemo<Slide[]>(() => {
    if (Array.isArray(body)) return body as Slide[];
    if (body && typeof body === 'object' && Array.isArray((body as { slides?: unknown }).slides)) {
      return (body as { slides: Slide[] }).slides;
    }
    return [];
  }, [body]);

  const [index, setIndex] = useState(0);
  const total = slides.length;
  const safeIndex = Math.max(0, Math.min(index, total - 1));
  const slide = slides[safeIndex];

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goPrev();
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') goNext();
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(Math.max(0, total - 1));
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, total]);

  if (total === 0 || !slide) {
    return <p className="px-4 py-3 text-sm italic text-muted">This deck has no slides yet.</p>;
  }

  return (
    <div>
      <div className="aspect-[16/9] bg-white p-6 sm:p-10 flex flex-col gap-4">
        <SlideRender slide={slide} />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-black/5 bg-surface-muted/40">
        <Button size="sm" variant="ghost" onClick={goPrev} disabled={safeIndex === 0}>
          ← Prev
        </Button>
        <span className="text-xs text-muted font-mono">
          Slide {safeIndex + 1} of {total}
        </span>
        <Button size="sm" variant="ghost" onClick={goNext} disabled={safeIndex === total - 1}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function SlideRender({ slide }: { slide: Slide }): JSX.Element {
  const c = slide.content;
  const heading = (slide.title ?? (c as { title?: string }).title ?? '').trim();
  const t = (c as { type?: string }).type;

  if (t === 'title') {
    const lines = asLines((c as { content?: unknown }).content);
    return (
      <div className="flex-1 grid place-items-center text-center">
        <div className="space-y-2">
          <h1 className="text-display-md text-brand-navy tracking-tight">{heading}</h1>
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-muted">{l}</p>
          ))}
        </div>
      </div>
    );
  }
  if (t === 'bullets') {
    const items = asLines((c as { content?: unknown }).content);
    return (
      <>
        {heading && <h2 className="text-display-sm text-brand-navy tracking-tight">{heading}</h2>}
        <ul className="list-disc list-outside pl-6 space-y-1.5 text-sm text-ink/85 leading-relaxed">
          {items.map((line, i) => (<li key={i}>{line}</li>))}
        </ul>
      </>
    );
  }
  if (t === 'two_column') {
    const left = asLines((c as { leftColumn?: unknown }).leftColumn);
    const right = asLines((c as { rightColumn?: unknown }).rightColumn);
    return (
      <>
        {heading && <h2 className="text-display-sm text-brand-navy tracking-tight">{heading}</h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ul className="list-disc list-outside pl-6 space-y-1 text-sm text-ink/85">
            {left.map((line, i) => (<li key={i}>{line}</li>))}
          </ul>
          {right.length > 0 && (
            <ul className="list-disc list-outside pl-6 space-y-1 text-sm text-ink/85">
              {right.map((line, i) => (<li key={i}>{line}</li>))}
            </ul>
          )}
        </div>
      </>
    );
  }
  if (t === 'table') {
    const tbl = (c as { table?: { headers?: unknown; rows?: unknown } }).table ?? null;
    const headers = tbl ? asLines(tbl.headers) : [];
    const rows = tbl ? asGrid(tbl.rows) : [];
    return (
      <>
        {heading && <h2 className="text-display-sm text-brand-navy tracking-tight">{heading}</h2>}
        {headers.length > 0 && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="text-left font-semibold border-b-2 border-black/10 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-black/5">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 align-top">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }
  return (
    <pre className="text-xs leading-relaxed bg-surface-muted p-3 rounded-lg whitespace-pre-wrap overflow-auto">
      {JSON.stringify(c, null, 2)}
    </pre>
  );
}

// ---------- Assignment item with inline submit ----------

function AssignmentItem({
  assignment: a,
}: {
  assignment: StudentSessionDetail['assignments'][number];
}): JSX.Element {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const detailQ = useQuery({
    queryKey: ['student-assignment', a.id],
    queryFn: () => assignmentsApi.get(a.id),
    enabled: open,
    retry: false,
  });
  const [bodyText, setBodyText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [seeded, setSeeded] = useState(false);
  const submitMut = useMutation({
    mutationFn: () =>
      assignmentsApi.submit(a.id, {
        bodyText: bodyText.trim(),
        attachmentUrl: attachmentUrl.trim() ? attachmentUrl.trim() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-assignment', a.id] });
      qc.invalidateQueries({ queryKey: ['student-session'] });
      qc.invalidateQueries({ queryKey: ['student-view'] });
    },
  });

  if (detailQ.data && !seeded) {
    setBodyText(detailQ.data.mySubmission?.bodyText ?? '');
    setAttachmentUrl(detailQ.data.mySubmission?.attachmentUrl ?? '');
    setSeeded(true);
  }

  const submitErr = submitMut.error instanceof Error ? submitMut.error.message : null;
  const isClosed = detailQ.data?.assignment.state === 'closed';
  const submitted = Boolean(detailQ.data?.mySubmission);

  const meta = a.status === 'graded'
    ? 'Graded · feedback available'
    : a.status === 'submitted'
      ? 'Submitted · awaiting grade'
      : a.status === 'late'
        ? `Was due ${formatShortDate(a.dueAt)}`
        : `Due ${formatShortDate(a.dueAt)}`;

  return (
    <li className="rounded-2xl border border-black/5 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/40 text-left"
      >
        <span aria-hidden className={`shrink-0 h-7 w-7 rounded-full grid place-items-center text-sm font-bold ${
          a.status === 'graded' ? 'bg-success/10 text-success'
            : a.status === 'late' ? 'bg-danger/10 text-danger'
              : a.status === 'dueSoon' ? 'bg-amber-100 text-amber-800'
                : a.status === 'submitted' ? 'bg-navy-100 text-brand-navy'
                  : 'bg-surface-muted text-muted'
        }`}>
          {a.status === 'graded' ? '✓' : a.status === 'late' ? '!' : a.status === 'submitted' ? '↑' : '·'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-brand-navy truncate">{a.title}</div>
          <div className="text-xs text-muted mt-0.5">{meta}</div>
        </div>
        {a.status === 'graded' && a.score !== null ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-800 tabular-nums shrink-0">
            {a.score} / {a.maxPoints}
          </span>
        ) : (
          <span className="text-xs text-muted whitespace-nowrap">
            {a.status === 'late' ? `${Math.abs(a.daysUntilDue)}d late`
              : a.status === 'dueSoon' ? `${a.daysUntilDue}d`
                : a.status === 'submitted' ? 'Submitted'
                  : `in ${a.daysUntilDue}d`}
          </span>
        )}
        <span aria-hidden className={`text-muted/60 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-black/5 p-4 bg-surface-muted/40">
          {detailQ.isLoading ? (
            <Skeleton lines={3} />
          ) : detailQ.isError || !detailQ.data ? (
            <p className="text-sm text-danger">Couldn't load this assignment.</p>
          ) : (
            <>
              {detailQ.data.assignment.instructions && (
                <p className="text-sm text-ink/85 whitespace-pre-wrap leading-relaxed max-w-[68ch]">
                  {detailQ.data.assignment.instructions}
                </p>
              )}
              {a.status === 'graded' && a.feedback && (
                <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm">
                  <p className="font-semibold text-green-900 mb-1">Faculty feedback</p>
                  <p className="whitespace-pre-wrap text-ink/90 max-w-[68ch]">{a.feedback}</p>
                </div>
              )}
              {isClosed ? (
                <div className="mt-3 rounded-xl border border-black/10 bg-white p-3 text-sm text-muted">
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
            </>
          )}
        </div>
      )}
    </li>
  );
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
