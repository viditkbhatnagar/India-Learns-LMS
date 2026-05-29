import { useState, type JSX, type ReactNode } from 'react';
import { internalFileId, openFile } from '../lib/fileAccess.js';

interface FileLinkProps {
  /** An internal `/v1/files/:id` URL or id, or an external URL. */
  url: string;
  children: ReactNode;
  className?: string;
}

/**
 * Renders a file link that works regardless of where the file lives.
 * Internal proxy files (`/v1/files/:id`) are fetched with auth and
 * opened from a blob — a plain anchor would 401 because the new-tab
 * navigation carries no bearer token. External URLs render as a normal
 * anchor. Shows a tiny "Opening…" / error state for the authed path.
 */
export function FileLink({ url, children, className }: FileLinkProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const isInternal = internalFileId(url) !== null;

  if (!isInternal) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-busy={busy}
      onClick={() => {
        setErr(false);
        setBusy(true);
        openFile(url)
          .catch(() => setErr(true))
          .finally(() => setBusy(false));
      }}
    >
      {children}
      {busy && <span className="ml-1 text-xs text-muted">opening…</span>}
      {err && <span className="ml-1 text-xs text-danger">couldn’t open</span>}
    </button>
  );
}
