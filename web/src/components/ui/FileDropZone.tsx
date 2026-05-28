import { useRef, useState, type DragEvent, type JSX } from 'react';

// Reusable file drop zone. The PRIMARY path is drag-and-drop, which
// hands us a File via the drop event WITHOUT ever opening the native OS
// file-picker dialog. That dialog hangs ("Open — Not Responding") on
// Windows machines with OneDrive Files On-Demand, so faculty couldn't
// upload at all. Dragging a file from Explorer bypasses the dialog
// entirely.
//
// A "browse" click fallback is still offered for users who prefer it
// (it does open the native dialog), but drag-and-drop is always
// available so there's a path that works in every scenario.

export interface FileDropZoneProps {
  /** Called with the chosen file (drag-drop or browse). */
  onFile: (file: File) => void;
  /** `accept` for the hidden <input> browse fallback. */
  accept?: string;
  /** Max size in bytes; oversize files are rejected before onFile. */
  maxBytes?: number;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  /** Idle prompt, e.g. "Drag a PowerPoint here". */
  label?: string;
  /** Sub-line, e.g. "PDF or Word, 5 MB max". */
  hint?: string;
}

export function FileDropZone({
  onFile,
  accept,
  maxBytes,
  disabled = false,
  busy = false,
  busyLabel = 'Uploading…',
  label = 'Drag a file here',
  hint,
}: FileDropZoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const CLOUD_FILE_HINT =
    "Couldn't read that file. If it lives in OneDrive/cloud, open File Explorer, " +
    'right-click it → “Always keep on this device”, then try again — or paste a ' +
    'shareable link in the URL field instead.';

  function accept1(file: File | undefined | null): void {
    setDropError(null);
    // A cloud/online-only file (OneDrive Files On-Demand) can come through
    // with no bytes — size 0 and unreadable. Treat empty/zero-byte as the
    // "no local copy" case and tell the user how to fix it, instead of
    // silently doing nothing.
    if (!file || file.size === 0) {
      setDropError(CLOUD_FILE_HINT);
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      const mb = (maxBytes / (1024 * 1024)).toFixed(0);
      setDropError(`That file is larger than ${mb} MB.`);
      return;
    }
    onFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file =
      e.dataTransfer.files && e.dataTransfer.files.length > 0
        ? e.dataTransfer.files[0]
        : null;
    accept1(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    if (!disabled && !busy) setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
  }

  // Browse fallback. On Chromium we use the File System Access API so we
  // can hint the dialog to start in Downloads with a dedicated `id` — this
  // sidesteps the case where the plain <input> dialog defaults to OneDrive
  // and hangs (OneDrive Files On-Demand). Everywhere else we fall back to
  // the native <input>.
  async function openPicker(): Promise<void> {
    if (disabled || busy) return;
    const w = window as unknown as {
      showOpenFilePicker?: (opts: {
        id?: string;
        startIn?: string;
        multiple?: boolean;
      }) => Promise<Array<{ getFile: () => Promise<File> }>>;
    };
    if (typeof w.showOpenFilePicker === 'function') {
      try {
        const handles = await w.showOpenFilePicker({
          id: 'india-learns-upload',
          startIn: 'downloads',
          multiple: false,
        });
        const file = await handles[0]?.getFile();
        if (file) accept1(file);
        return;
      } catch (err) {
        // User cancelled — do nothing. Any other failure → fall through
        // to the classic <input> picker.
        if ((err as DOMException | undefined)?.name === 'AbortError') return;
      }
    }
    inputRef.current?.click();
  }

  return (
    <div>
      <div
        data-testid="file-drop-zone"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => {
          openPicker().catch(() => undefined);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) {
            e.preventDefault();
            openPicker().catch(() => undefined);
          }
        }}
        className={[
          'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors',
          disabled
            ? 'opacity-50 cursor-not-allowed border-black/10'
            : 'cursor-pointer',
          dragging
            ? 'border-brand-orange bg-brand-orange/5'
            : 'border-black/15 bg-white/60 hover:border-black/30',
        ].join(' ')}
      >
        <span className="text-sm text-ink/80">
          {busy ? (
            <>⏳ {busyLabel}</>
          ) : dragging ? (
            'Drop to upload'
          ) : (
            <>
              📎 {label}{' '}
              <span className="text-muted">
                or <span className="underline">browse</span>
              </span>
            </>
          )}
        </span>
        {hint && !busy && <span className="text-xs text-muted">{hint}</span>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            accept1(f);
            e.target.value = '';
          }}
        />
      </div>
      {dropError && <p className="mt-1.5 text-xs text-danger">{dropError}</p>}
    </div>
  );
}
