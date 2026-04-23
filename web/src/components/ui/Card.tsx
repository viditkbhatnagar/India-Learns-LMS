import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

type Elevation = 'flat' | 'low' | 'med';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: Elevation;
  interactive?: boolean;
  /** Adds a subtle brand-accent top border. Useful for hero-like cards. */
  accent?: 'orange' | 'navy' | 'none';
}

const elevationClass: Record<Elevation, string> = {
  flat: 'shadow-none border border-black/5',
  low: 'shadow-elev-1 border border-black/5',
  med: 'shadow-elev-2 border border-black/5',
};

export function Card({
  className,
  children,
  elevation = 'low',
  interactive = false,
  accent = 'none',
  ...rest
}: PropsWithChildren<CardProps>) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl p-6 transition-all duration-200 ease-decel',
        elevationClass[elevation],
        interactive &&
          'hover:shadow-elev-3 hover:-translate-y-0.5 cursor-pointer focus-within:ring-2 focus-within:ring-brand-navy/20',
        accent === 'orange' && 'border-t-2 border-t-brand-orange',
        accent === 'navy' && 'border-t-2 border-t-brand-navy',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-brand-navy font-semibold text-lg leading-tight tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
