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
  const [sizeError, setSizeError] = useState<string | null>(null);

  function accept1(file: File | undefined | null): void {
    if (!file) return;
    setSizeError(null);
    if (maxBytes && file.size > maxBytes) {
      const mb = (maxBytes / (1024 * 1024)).toFixed(0);
      setSizeError(`That file is larger than ${mb} MB.`);
      return;
    }
    onFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    // Prefer the items API (more robust across browsers) then fall back.
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

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => {
          if (!disabled && !busy) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !busy) {
            e.preventDefault();
            inputRef.current?.click();
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
      {sizeError && <p className="mt-1.5 text-xs text-danger">{sizeError}</p>}
    </div>
  );
}
