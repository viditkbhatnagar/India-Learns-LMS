import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { FileDropZone } from '../../components/ui/FileDropZone.js';
import { Badge } from '../../components/ui/Badge.js';
import { ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { ApiHttpError } from '../../lib/api.js';
import { filesApi, materialsApi, type MaterialDetailDto } from '../../lib/endpoints.js';
import { asGrid, asLines } from '../../lib/slideShape.js';
import { useAuthStore } from '../../store/auth.js';
import { useOptionalCourseOversight } from '../../contexts/CourseOversightContext.js';

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
  const oversight = useOptionalCourseOversight();
  const isOversight = oversight?.isOversight ?? false;
  const oversightTitle = 'Read-only in oversight mode';
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
        <div className="flex items-center gap-3 flex-wrap">
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
          {me?.role !== 'student' && (
            <SlideToolbar
              material={material}
              isOversight={isOversight}
              oversightTitle={oversightTitle}
            />
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


/**
 * PR #16 Phase 2 — slide deck management. Faculty can:
 *   - Download the current deck as a JSON file
 *   - Replace the deck by uploading an edited JSON file
 *
 * Replace is gated on oversight (server enforces too). Download is
 * always available for staff. PPTX-format upload is not supported here
 * — the curriculum-import flow already handles that path; this is the
 * "download → tweak → re-upload" loop.
 */
function SlideToolbar({
  material,
  isOversight,
  oversightTitle,
}: {
  material: MaterialDetailDto;
  isOversight: boolean;
  oversightTitle: string;
}): JSX.Element {
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [attachedName, setAttachedName] = useState<string | null>(null);

  const replaceMut = useMutation({
    mutationFn: (next: unknown) => materialsApi.replaceSlides(material.id, next),
    onSuccess: () => {
      setErr(null);
      setSavedAt(new Date().toISOString());
      setReplaceOpen(false);
      qc.invalidateQueries({ queryKey: ['material', material.id] });
      qc.invalidateQueries({ queryKey: ['session', material.sessionId] });
    },
    onError: (e) => setErr(e instanceof ApiHttpError ? e.message : 'Replace failed.'),
  });

  // Upload a PowerPoint / PDF and attach it to THIS session as a
  // downloadable material — the path faculty actually want from the
  // slides page (Logan kept reaching for "Replace deck" with a .pptx,
  // which is JSON-only). Bytes → S3 via filesApi.upload, then a new
  // session material points at the proxy URL so students can download.
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const attachFileMut = useMutation({
    mutationFn: async (file: File) => {
      if (!material.sessionId) {
        throw new Error('This deck is not attached to a session, so a file can’t be added here.');
      }
      const { url } = await filesApi.upload(file, 'course-pdfs');
      await materialsApi.createOnSession(material.sessionId, {
        type: 'file',
        title: file.name.replace(/\.[^.]+$/, '') || 'Uploaded file',
        url,
      });
      return file.name;
    },
    onSuccess: (name) => {
      setFileErr(null);
      setAttachedName(name);
      setFileOpen(false);
      qc.invalidateQueries({ queryKey: ['session', material.sessionId] });
    },
    onError: (e) => setFileErr(e instanceof ApiHttpError ? e.message : 'Upload failed.'),
  });

  function handleDownload(): void {
    const slides = Array.isArray(material.body)
      ? material.body
      : (material.body && typeof material.body === 'object'
          && Array.isArray((material.body as { slides?: unknown }).slides))
        ? (material.body as { slides: unknown[] }).slides
        : [];
    const blob = new Blob([JSON.stringify(slides, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(material.title || 'slides').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'slides'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Replace deck takes a JSON export of the slide structure — NOT a
  // PowerPoint/PDF. Guard before reading: a .pptx is tens of MB of
  // binary, and `file.text()` + `JSON.parse()` on the main thread froze
  // the tab (and the OS file dialog) when faculty picked one. Validate
  // type + size first; never read a non-JSON or oversized file.
  const MAX_JSON_BYTES = 5 * 1024 * 1024;
  async function handleReplaceFile(file: File): Promise<void> {
    setErr(null);
    const isJson =
      file.type === 'application/json' || /\.json$/i.test(file.name);
    if (!isJson) {
      setErr(
        'Replace deck expects a JSON export of the slides. To share a PowerPoint or PDF with students, use “+ Add material” on the session and upload the file there.',
      );
      return;
    }
    if (file.size > MAX_JSON_BYTES) {
      setErr('That JSON file is larger than 5 MB — slide exports are normally a few KB. Double-check the file.');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      replaceMut.mutate(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not parse JSON.');
    }
  }

  const canAttachFile = Boolean(material.sessionId);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="inline-flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={handleDownload}>
          Download deck
        </Button>
        {/* Primary path for "I have a PowerPoint/PDF" — attaches it to the
            session as a downloadable material, no leaving the page. */}
        {canAttachFile && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isOversight}
            title={
              isOversight
                ? oversightTitle
                : 'Upload a PowerPoint or PDF — students can download it from this session.'
            }
            onClick={() => {
              setFileOpen((v) => !v);
              setReplaceOpen(false);
            }}
          >
            Upload PowerPoint / PDF
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={isOversight}
          title={
            isOversight
              ? oversightTitle
              : 'Advanced: replace the rendered slides from a JSON export (download → tweak → re-upload).'
          }
          onClick={() => {
            setReplaceOpen((v) => !v);
            setFileOpen(false);
          }}
        >
          Replace deck (JSON)
        </Button>
        {savedAt && !err && !replaceMut.isPending && (
          <span className="text-xs text-success">Replaced.</span>
        )}
        {attachedName && !attachFileMut.isPending && !fileErr && (
          <span className="text-xs text-success">Added — students can download it.</span>
        )}
      </div>
      {fileOpen && !isOversight && canAttachFile && (
        <div className="w-80">
          <FileDropZone
            onFile={(f) => {
              setFileErr(null);
              attachFileMut.mutate(f);
            }}
            accept=".pdf,.ppt,.pptx,.doc,.docx,.key,application/pdf"
            maxBytes={MAX_FILE_BYTES}
            busy={attachFileMut.isPending}
            busyLabel="Uploading…"
            label="Drag a PowerPoint / PDF here"
            hint="Up to 25 MB. Students get a download link on this session."
          />
          {fileErr && <p className="mt-1.5 text-xs text-danger">{fileErr}</p>}
        </div>
      )}
      {replaceOpen && !isOversight && (
        <div className="w-72">
          <FileDropZone
            onFile={(f) => {
              handleReplaceFile(f).catch(() => undefined);
            }}
            accept="application/json,.json"
            maxBytes={5 * 1024 * 1024}
            busy={replaceMut.isPending}
            busyLabel="Replacing…"
            label="Drag a slides JSON export here"
            hint="Advanced — JSON export only (a few KB)."
          />
        </div>
      )}
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
