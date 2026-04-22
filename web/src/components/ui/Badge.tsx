import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
type Size = 'sm' | 'md';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-ink/80 border-black/10',
  info: 'bg-navy-50 text-brand-navy border-navy-100',
  success: 'bg-emerald-50 text-success border-emerald-200',
  warning: 'bg-amber-50 text-warning border-amber-200',
  danger: 'bg-red-50 text-danger border-red-200',
  accent: 'bg-orange-50 text-brand-orange border-orange-100',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  children,
  tone = 'neutral',
  size = 'sm',
  className,
  dot = false,
}: PropsWithChildren<{ tone?: Tone; size?: Size; className?: string; dot?: boolean }>) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={clsx(
            'inline-block h-1.5 w-1.5 rounded-full',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-danger',
            tone === 'info' && 'bg-brand-navy',
            tone === 'accent' && 'bg-brand-orange',
            tone === 'neutral' && 'bg-muted',
          )}
        />
      )}
      {children}
    </span>
  );
}
