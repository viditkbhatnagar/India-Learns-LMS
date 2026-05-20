import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role, UserPublicDto } from 'india-learns-shared-types';
import { usersApi } from '../../lib/endpoints.js';

// M10w — Reusable user picker (combobox). Replaces the "type to search →
// list of results" pattern with a proper drop-down: closed by default,
// click opens it, type filters, click or Enter selects, Esc closes.
//
// Usage:
//   <UserPicker
//     label="Find the student"
//     placeholder="Pick a student…"
//     role="student"
//     value={selected}
//     onChange={(u) => setSelected(u)}
//   />
//
// Caller owns the selected state; the picker just reads / writes it.

export interface UserPickerProps {
  label?: string;
  placeholder?: string;
  /** Filter users by role server-side. Omit to allow any role. */
  role?: Role;
  /** Currently selected user (or null). */
  value: UserPublicDto | null;
  /** Called when user clicks a result or clears. */
  onChange: (user: UserPublicDto | null) => void;
  /** Filter the API result list further (e.g. limit to staff roles). */
  filter?: (user: UserPublicDto) => boolean;
  /** Show below the field as helper text. */
  hint?: string;
  /** Inline red-bordered error message. */
  error?: string | null;
  /** Disable interaction entirely. */
  disabled?: boolean;
  /** Required mark (informational; no enforcement here). */
  required?: boolean;
  /** Optional id for the trigger button (links to `<label htmlFor>`). */
  id?: string;
}

export function UserPicker({
  label,
  placeholder = 'Pick a user…',
  role,
  value,
  onChange,
  filter,
  hint,
  error,
  disabled = false,
  required = false,
  id,
}: UserPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Server search. We fire even with empty query so opening the dropdown
  // shows the first page of matching-role users immediately. Min-char gate
  // can be added back if the user list grows large enough to need it.
  const usersQ = useQuery({
    queryKey: ['user-picker', role ?? 'any', query],
    queryFn: () =>
      usersApi.list({
        role: role as string | undefined,
        q: query.trim() || undefined,
      }),
    enabled: open,
  });
  const items = (usersQ.data ?? []).filter((u) => (filter ? filter(u) : true));

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  // Focus the search input when opening.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setActiveIdx(0);
    }
  }, [open]);

  // Keep activeIdx within bounds when the result list shrinks.
  useEffect(() => {
    if (activeIdx >= items.length) {
      setActiveIdx(Math.max(0, items.length - 1));
    }
  }, [items.length, activeIdx]);

  function selectUser(u: UserPublicDto) {
    onChange(u);
    setOpen(false);
    setQuery('');
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[activeIdx];
      if (pick) selectUser(pick);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const triggerLabel = value
    ? `${value.name}${value.code ? ` · ${value.code}` : ''}`
    : placeholder;

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs uppercase tracking-wider text-muted font-bold"
        >
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'group relative h-11 px-3.5 rounded-xl border bg-white text-left',
          'flex items-center gap-2',
          'transition-all',
          disabled
            ? 'border-black/10 bg-surface-muted cursor-not-allowed opacity-70'
            : 'border-black/10 hover:border-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-navy/15',
          error ? 'border-danger/50' : '',
        ].join(' ')}
      >
        <span
          className={`flex-1 truncate ${
            value ? 'text-ink' : 'text-muted'
          }`}
        >
          {triggerLabel}
        </span>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="text-muted hover:text-danger px-1"
            tabIndex={-1}
          >
            ✕
          </button>
        )}
        <span aria-hidden className="text-muted">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="absolute z-50 mt-[3.6rem] w-full max-w-md rounded-xl border border-black/10 bg-white shadow-elev-3 overflow-hidden"
          style={{ position: 'absolute' }}
        >
          <div className="p-2 border-b border-black/5 bg-surface-muted/30">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type to filter…"
              className="w-full h-9 px-3 rounded-lg border border-black/10 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/15"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {usersQ.isLoading && (
              <li className="px-4 py-3 text-sm text-muted">Searching…</li>
            )}
            {!usersQ.isLoading && items.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">
                No matches. Try a different name / email / code.
              </li>
            )}
            {items.map((u, idx) => {
              const active = idx === activeIdx;
              const selected = value?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => selectUser(u)}
                    className={[
                      'w-full text-left px-4 py-2.5 flex items-center gap-3',
                      active ? 'bg-navy-50' : 'bg-white',
                      selected ? 'font-semibold' : '',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden
                      className="shrink-0 h-7 w-7 rounded-lg bg-navy-100 text-brand-navy font-bold grid place-items-center text-xs"
                    >
                      {(u.name ?? '?').trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-brand-navy truncate">{u.name}</p>
                      <p className="text-xs text-muted truncate">
                        {u.role}
                        {u.email ? ` · ${u.email}` : ''}
                        {u.code ? ` · ${u.code}` : ''}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
