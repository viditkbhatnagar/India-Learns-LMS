import type { JSX } from 'react';
import type { GlossaryEntryDto, ReadingItemDto } from 'india-learns-shared-types';
import { Button } from './ui/Button.js';
import { Input, TextArea } from './ui/Input.js';

// Controlled editors for a glossary / reading list. Pure value+onChange
// components reused by the course-level tabs and the per-module panel
// (Logan: glossary + reading list, course and module wise). The caller
// owns persistence.

export function GlossaryEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: GlossaryEntryDto[];
  onChange: (next: GlossaryEntryDto[]) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((row, i) => (
            <li key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <Input
                aria-label="Term"
                placeholder="Term"
                value={row.term}
                disabled={disabled}
                onChange={(e) =>
                  onChange(value.map((r, j) => (j === i ? { ...r, term: e.target.value } : r)))
                }
              />
              <TextArea
                aria-label="Definition"
                placeholder="Definition"
                rows={2}
                value={row.definition}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    value.map((r, j) => (j === i ? { ...r, definition: e.target.value } : r)),
                  )
                }
              />
              {!disabled && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-red-50"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([...value, { term: '', definition: '' }])}
        >
          + Add term
        </Button>
      )}
    </div>
  );
}

export function ReadingListEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: ReadingItemDto[];
  onChange: (next: ReadingItemDto[]) => void;
  disabled?: boolean;
}): JSX.Element {
  function patch(i: number, key: keyof ReadingItemDto, v: string): void {
    onChange(value.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  }
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-3">
          {value.map((row, i) => (
            <li key={i} className="rounded-xl border border-black/5 bg-white p-3 space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  aria-label="Title"
                  placeholder="Title (required)"
                  value={row.title}
                  disabled={disabled}
                  onChange={(e) => patch(i, 'title', e.target.value)}
                />
                <Input
                  aria-label="Author"
                  placeholder="Author (optional)"
                  value={row.author}
                  disabled={disabled}
                  onChange={(e) => patch(i, 'author', e.target.value)}
                />
              </div>
              <Input
                aria-label="Link"
                type="url"
                placeholder="https://… (optional)"
                value={row.url}
                disabled={disabled}
                onChange={(e) => patch(i, 'url', e.target.value)}
              />
              <Input
                aria-label="Note"
                placeholder="Note, e.g. chapters 1–3 (optional)"
                value={row.note}
                disabled={disabled}
                onChange={(e) => patch(i, 'note', e.target.value)}
              />
              {!disabled && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:bg-red-50"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onChange([...value, { title: '', author: '', url: '', note: '' }])}
        >
          + Add reading
        </Button>
      )}
    </div>
  );
}
