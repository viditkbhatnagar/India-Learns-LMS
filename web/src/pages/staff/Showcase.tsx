import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import FocusTrap from 'focus-trap-react';
import { useQuery } from '@tanstack/react-query';
import {
  SHOWCASE_CATEGORY_LABELS,
  type ShowcaseCategory,
  type ShowcaseDocumentDto,
} from 'india-learns-shared-types';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton, ErrorAlert, EmptyState } from '../../components/ui/States.js';
import { showcaseApi } from '../../lib/endpoints.js';

// Showcase — staff-only marketing collateral. Admin / Superadmin / Faculty
// browse the India Learns company profile + program brochures and present
// any of them full-screen, in-app. The PDFs live in GridFS and are fetched
// as an authed blob from the staff-gated `/v1/showcase/:id/file` route (a
// bearer token an <iframe src> can't send), then rendered by the browser's
// native PDF viewer inside a full-bleed overlay.

const BADGE_TONE: Record<ShowcaseCategory, 'info' | 'accent' | 'success' | 'neutral'> = {
  profile: 'accent',
  program: 'info',
  brochure: 'success',
  other: 'neutral',
};

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ShowcasePage(): JSX.Element {
  const [active, setActive] = useState<ShowcaseDocumentDto | null>(null);

  const q = useQuery({
    queryKey: ['showcase'],
    queryFn: () => showcaseApi.list(),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Present"
        title="Showcase"
        subtitle="Open the India Learns profile and program brochures and present them on screen."
      />

      {q.isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton variant="card" />
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </div>
      )}

      {q.isError && <ErrorAlert message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {q.data && q.data.length === 0 && (
        <EmptyState
          title="No showcase documents yet"
          message="Once the showcase collateral is ingested, the company profile and program brochures appear here to present."
        />
      )}

      {q.data && q.data.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((doc) => (
            <ShowcaseCard key={doc.id} doc={doc} onPresent={() => setActive(doc)} />
          ))}
        </div>
      )}

      {active && <ShowcaseViewer doc={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function ShowcaseCard({
  doc,
  onPresent,
}: {
  doc: ShowcaseDocumentDto;
  onPresent: () => void;
}): JSX.Element {
  const size = formatSize(doc.sizeBytes);
  return (
    <Card className="group flex flex-col p-0 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-elev-3">
      {/* Category accent header */}
      <div className="relative h-28 bg-brand-navy overflow-hidden">
        <div className="absolute inset-0 bg-accent-gradient opacity-90" />
        <div className="absolute inset-0 p-5 flex flex-col justify-between">
          <Badge tone={BADGE_TONE[doc.category]} className="self-start bg-white/90 text-brand-navy">
            {SHOWCASE_CATEGORY_LABELS[doc.category]}
          </Badge>
          <PdfGlyph />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold text-brand-navy leading-snug tracking-tight">
          {doc.title}
        </h3>
        {doc.description && (
          <p className="text-sm text-muted leading-relaxed line-clamp-4">{doc.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-xs text-muted font-mono uppercase">
            PDF{size ? ` · ${size}` : ''}
          </span>
          <Button size="sm" onClick={onPresent}>
            Present ↗
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ShowcaseViewer({
  doc,
  onClose,
}: {
  doc: ShowcaseDocumentDto;
  onClose: () => void;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hold the raw Blob so "Open in new tab" can mint its OWN object URL with an
  // independent lifecycle — the viewer's `blobUrl` is revoked on unmount, and
  // reusing it for a new tab would break a still-loading tab.
  const blobRef = useRef<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch the PDF as an authed blob, then hand the object URL to the native
  // viewer. Revoke on unmount / doc change so we don't leak large buffers.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setErr(null);
    setProgress(0);
    setBlobUrl(null);
    blobRef.current = null;
    showcaseApi
      .fetchFileBlob(doc.id, (f) => {
        if (!cancelled) setProgress(f);
      })
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => {
        if (!cancelled)
          setErr('Could not load this document. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape closes the viewer (unless the browser is handling it to exit
  // native fullscreen first).
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Track native fullscreen so the toggle label stays honest.
  useEffect(() => {
    function onFsChange(): void {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const req = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
    req?.catch(() => undefined);
  }, []);

  const openInNewTab = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    // Mint a fresh object URL owned by the new tab (independent of the
    // viewer's blobUrl, which is revoked on close). Fall back to a forced
    // download if a pop-up blocker swallows the window.open. Revoke after a
    // grace period so the tab/download has time to read it.
    const tabUrl = URL.createObjectURL(blob);
    const win = window.open(tabUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = tabUrl;
      a.download = doc.originalFilename || `${doc.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(tabUrl), 60_000);
  }, [doc.originalFilename, doc.slug]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.title} — presentation`}
      className="fixed inset-0 z-50 bg-brand-navy"
    >
      <FocusTrap
        active
        focusTrapOptions={{
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          initialFocus: '#showcase-close',
          fallbackFocus: '#showcase-viewer-inner',
        }}
      >
        <div
          id="showcase-viewer-inner"
          tabIndex={-1}
          className="flex h-full w-full flex-col outline-none"
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-navy text-white shrink-0">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/60">
                {SHOWCASE_CATEGORY_LABELS[doc.category]}
              </p>
              <h2 className="text-base font-semibold truncate">{doc.title}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={openInNewTab}
                disabled={!blobUrl}
              >
                Open in new tab
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </Button>
              <Button
                id="showcase-close"
                size="sm"
                variant="secondary"
                onClick={onClose}
                aria-label="Close presentation"
              >
                Close ✕
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="relative flex-1 bg-neutral-800">
            {!blobUrl && !err && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                <div className="w-64 max-w-[70vw]">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-brand-orange transition-[width] duration-200"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-center text-sm text-white/70">
                    Loading document… {Math.round(progress * 100)}%
                  </p>
                </div>
              </div>
            )}

            {err && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-white px-6">
                <p className="text-sm text-white/80 max-w-sm">{err}</p>
                <Button size="sm" variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}

            {blobUrl && (
              <iframe
                src={blobUrl}
                title={doc.title}
                className="absolute inset-0 h-full w-full border-0 bg-white"
              />
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

function PdfGlyph(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-8 w-8 text-white/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}
