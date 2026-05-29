import { api } from './api.js';

// Internal files are served by the bearer-auth-gated `/v1/files/:id`
// proxy. A plain <a href> opened as a new-tab navigation carries NO
// Authorization header (the token lives in JS, not a cookie), so it
// 401s. To open an internal file we fetch it through the authed axios
// client as a blob and open that. External URLs (Drive links a faculty
// pasted, etc.) are opened directly.

const FILE_ID_RE = /^[a-f0-9]{24}$/i;
const PROXY_PATH_RE = /\/v1\/files\/([a-f0-9]{24})(?:[?#]|$)/i;

/** Returns the FileMeta id if `value` is an internal proxy id/URL, else null. */
export function internalFileId(value: string | null | undefined): string | null {
  if (!value) return null;
  if (FILE_ID_RE.test(value)) return value;
  const m = PROXY_PATH_RE.exec(value);
  return m ? m[1]! : null;
}

/**
 * Open a file the user clicked. Internal proxy files are fetched with
 * auth and opened from a blob URL (PDFs/images preview in the new tab,
 * other types download). External URLs open directly. Returns a promise
 * that rejects on fetch failure so callers can surface an error.
 */
export async function openFile(idOrUrl: string): Promise<void> {
  const id = internalFileId(idOrUrl);
  if (!id) {
    window.open(idOrUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const res = await api.get(`/files/${id}`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Pop-up blocked — fall back to a forced download.
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Give the new tab time to load before revoking.
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
