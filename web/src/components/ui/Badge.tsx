import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-brand-cream text-ink border-black/10',
  info: 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  success: 'bg-emerald-50 text-success border-emerald-200',
  warning: 'bg-amber-50 text-warning border-amber-200',
  danger: 'bg-red-50 text-danger border-red-200',
  accent: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30',
};

export function Badge({ children, tone = 'neutral', className }: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
