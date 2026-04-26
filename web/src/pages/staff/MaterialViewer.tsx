import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { materialsApi, type MaterialDetailDto } from '../../lib/endpoints.js';
import { asGrid, asLines } from '../../lib/slideShape.js';
import { useAuthStore } from '../../store/auth.js';

/**
 * Phase B-2 follow-up: render the slide JSON the curriculum import
 * persisted as `Material.body` for type='slides'. Click-through from the
 * Materials list on the session detail page lands here. Faculty can flip
 * speaker notes on; the route itself is staff-only at the API layer so
 * student exposure to speaker notes is impossible by construction.
 *
 * Mounted at /courses/:id/sessions/:sessionId/materials/:materialId
 * inside the CourseShell so the shell header + tabs stay visible.
 *
 * The slide payload from the generator is shaped like:
 *   { slideNumber, slideType, title, content: { type, ...variant }, speakerNotes }
 * Variants seen in real fixtures: 'title', 'bullets', 'two_column', 'table'.
 * Anything else falls through to a JSON dump so we never blank-render an
 * unknown shape.
 *
 * Non-slide material types (reading, link, file, video, etc.) render a
 * generic fallback with title + URL/download. Phase A only persists
 * slides today; the fallback is forward-compatible cover.
 */

interface SlideTitle {
  type: 'title';
  title?: string | null;
  content?: string[] | null;
}
interface SlideBullets {
  type: 'bullets';
  title?: string | null;
  content?: string[] | null;
}
interface SlideTwoColumn {
  type: 'two_column';
  title?: string | null;
  leftColumn?: string[] | null;
  rightColumn?: string[] | null;
}
interface SlideTable {
  type: 'table';
  title?: string | null;
  content?: unknown;
  table?: { headers?: string[]; rows?: string[][] } | null;
}
type SlideContent = SlideTitle | SlideBullets | SlideTwoColumn | SlideTable | { type?: string; [k: string]: unknown };

interface Slide {
  slideNumber: number;
  slideType: string;
  title?: string | null;
  content: SlideContent;
  speakerNotes?: string | null;
}

export function MaterialViewerPage(): JSX.Element | null {
  const params = useParams<{ id?: string; sessionId?: string; materialId?: string }>();
  const courseId = params.id ?? '';
  const sessionId = params.sessionId ?? '';
  const materialId = params.materialId ?? '';
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ['material', materialId],
    queryFn: () => materialsApi.get(materialId),
    enabled: Boolean(materialId),
  });

  const onClose = useCallback(() => {
    if (sessionId) navigate(`/courses/${courseId}/sessions/${sessionId}`);
    else navigate(`/courses/${courseId}/content`);
  }, [navigate, courseId, sessionId]);

  if (!materialId) return null;
  if (q.isLoading) return <Skeleton variant="card" />;
  if (q.isError) {
    return <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }
  if (!q.data) return null;
  const material = q.data;

  if (material.type === 'slides') {
    return <SlideViewer material={material} onClose={onClose} />;
  }
  return <GenericMaterialView material={material} onClose={onClose} />;
}

function SlideViewer({
  material,
  onClose,
}: {
  material: MaterialDetailDto;
  onClose: () => void;
}): JSX.Element {
  const me = useAuthStore((s) => s.user);
  const { body } = material;
  // PR #15 — body can come back as either an array of slides OR an object
  // wrapper like `{ slides: [...] }` (older Maths Certification fixtures).
  // Normalise either shape to Slide[]. Anything else degrades gracefully
  // to the "no slides" empty card below.
  const slides = useMemo<Slide[]>(() => {
    if (Array.isArray(body)) return body as Slide[];
    if (body && typeof body === 'object' && Array.isArray((body as { slides?: unknown }).slides)) {
      return (body as { slides: Slide[] }).slides;
    }
    return [];
  }, [body]);

  const [index, setIndex] = useState(0);
  // Faculty default speaker-notes ON; students never reach this route.
  const [showNotes, setShowNotes] = useState(true);

  const total = slides.length;
  const safeIndex = Math.max(0, Math.min(index, total - 1));
  const slide = slides[safeIndex];

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  );

  // Keyboard navigation. Bound to the page so the operator doesn't need
  // to focus the buttons. Arrow keys, Home/End. Escape closes the viewer.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        goNext();
      } else if (e.key === 'Home') {
        setIndex(0);
      } else if (e.key === 'End') {
        setIndex(Math.max(0, total - 1));
      } else if (e.key === 'Escape') {
        onClose();
      } else {
        return;
      }
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, total, onClose]);

  if (total === 0 || !slide) {
    return (
      <Card>
        <CardHeader title={material.title} subtitle="Slides" />
        <p className="text-sm text-muted">This deck has no slides.</p>
        <div className="mt-3">
          <Button variant="ghost" onClick={onClose}>← Back</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-brand-orange hover:underline"
          >
            ← Back to session
          </button>
          <h2 className="text-display-sm text-brand-navy tracking-tight mt-1 truncate">
            {material.title}
          </h2>
          <p className="text-xs text-muted mt-1">
            {total} slide{total === 1 ? '' : 's'} · use ← / → to navigate
          </p>
        </div>
        <div className="flex items-center gap-2">
          {me?.role !== 'student' && (
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(e) => setShowNotes(e.target.checked)}
                className="accent-brand-orange"
              />
              <span>Speaker notes</span>
            </label>
          )}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="aspect-[16/9] bg-white p-8 sm:p-12 flex flex-col gap-6">
          <SlideRender slide={slide} />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-black/5 bg-surface-muted/40">
          <Button
            size="sm"
            variant="ghost"
            onClick={goPrev}
            disabled={safeIndex === 0}
          >
            ← Prev
          </Button>
          <span className="text-sm text-muted font-mono">
            Slide {safeIndex + 1} of {total}
            {slide.slideType ? ` · ${slide.slideType}` : ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={goNext}
            disabled={safeIndex === total - 1}
          >
            Next →
          </Button>
        </div>
      </Card>

      {showNotes && me?.role !== 'student' && (
        <Card>
          <CardHeader title="Speaker notes" subtitle="Faculty-only — never shown to students." />
          {slide.speakerNotes ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink/90 max-w-[68ch]">
              {slide.speakerNotes}
            </p>
          ) : (
            <p className="text-sm italic text-muted">No notes for this slide.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function SlideRender({ slide }: { slide: Slide }): JSX.Element {
  const c = slide.content as SlideContent;
  const heading = (slide.title ?? (c as { title?: string }).title ?? '').trim();
  const t = (c as { type?: string }).type;

  if (t === 'title') {
    const lines = asLines((c as SlideTitle).content);
    return (
      <div className="flex-1 grid place-items-center text-center">
        <div className="space-y-3">
          <h1 className="text-display-md text-brand-navy tracking-tight">{heading}</h1>
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-muted">{l}</p>
          ))}
        </div>
      </div>
    );
  }

  if (t === 'bullets') {
    const items = asLines((c as SlideBullets).content);
    return (
      <>
        {heading && <h1 className="text-display-sm text-brand-navy tracking-tight">{heading}</h1>}
        <ul className="list-disc list-outside pl-6 space-y-2 text-base text-ink/90 leading-relaxed">
          {items.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </>
    );
  }

  if (t === 'two_column') {
    const left = asLines((c as SlideTwoColumn).leftColumn);
    const right = asLines((c as SlideTwoColumn).rightColumn);
    return (
      <>
        {heading && <h1 className="text-display-sm text-brand-navy tracking-tight">{heading}</h1>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ul className="list-disc list-outside pl-6 space-y-2 text-sm text-ink/90 leading-relaxed">
            {left.map((line, i) => (<li key={i}>{line}</li>))}
          </ul>
          {right.length > 0 && (
            <ul className="list-disc list-outside pl-6 space-y-2 text-sm text-ink/90 leading-relaxed">
              {right.map((line, i) => (<li key={i}>{line}</li>))}
            </ul>
          )}
        </div>
      </>
    );
  }

  if (t === 'table') {
    const tbl = (c as SlideTable).table ?? null;
    const headers = tbl ? asLines(tbl.headers) : [];
    const rows = tbl ? asGrid(tbl.rows) : [];
    const fallback = asLines((c as { content?: unknown }).content);
    return (
      <>
        {heading && <h1 className="text-display-sm text-brand-navy tracking-tight">{heading}</h1>}
        {fallback.length > 0 && (
          <p className="text-sm text-ink/80">{fallback.join(' ')}</p>
        )}
        {headers.length > 0 && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="text-left font-semibold border-b-2 border-black/10 px-3 py-2">
                      {h}
                    </th>
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

  // Unknown shape — dump JSON so the operator at least sees the data.
  return (
    <>
      {heading && <h1 className="text-display-sm text-brand-navy tracking-tight">{heading}</h1>}
      <pre className="text-xs leading-relaxed bg-surface-muted p-3 rounded-lg whitespace-pre-wrap overflow-auto">
        {JSON.stringify(c, null, 2)}
      </pre>
    </>
  );
}

function GenericMaterialView({
  material,
  onClose,
}: {
  material: MaterialDetailDto;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="space-y-3 max-w-2xl">
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-brand-orange hover:underline"
      >
        ← Back to session
      </button>
      <Card>
        <CardHeader
          title={material.title}
          subtitle={material.type}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone="info">{material.type}</Badge>
          {material.sizeBytes && (
            <span className="text-muted">{Math.round(material.sizeBytes / 1024)} KB</span>
          )}
          {material.expectedHours && (
            <span className="text-muted">~{material.expectedHours} h</span>
          )}
        </div>
        {material.url ? (
          <a
            href={material.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block"
          >
            <Button>Open ↗</Button>
          </a>
        ) : (
          <p className="text-sm text-muted italic mt-4">
            No external URL on this material — Phase A imported the contents
            inline. Slide-deck rendering is the only built-in viewer for now.
          </p>
        )}
      </Card>
    </div>
  );
}
