import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: [
    'bg-accent-gradient text-white shadow-elev-2 hover:shadow-glow-orange',
    'hover:-translate-y-0.5 active:translate-y-0 active:shadow-elev-1',
    'focus-visible:ring-brand-orange/50',
  ].join(' '),
  secondary: [
    'bg-white text-brand-navy border border-navy-200 shadow-elev-1',
    'hover:border-navy-300 hover:shadow-elev-2 hover:-translate-y-0.5',
    'active:translate-y-0 active:shadow-elev-1',
    'focus-visible:ring-brand-navy/30',
  ].join(' '),
  ghost: [
    'bg-transparent text-brand-navy',
    'hover:bg-navy-50 active:bg-navy-100',
    'focus-visible:ring-brand-navy/20',
  ].join(' '),
  outline: [
    'bg-transparent text-brand-navy border-2 border-brand-navy',
    'hover:bg-brand-navy hover:text-white',
    'focus-visible:ring-brand-navy/30',
  ].join(' '),
  danger: [
    'bg-danger text-white shadow-elev-2',
    'hover:bg-red-700 hover:-translate-y-0.5',
    'active:translate-y-0 active:shadow-elev-1',
    'focus-visible:ring-danger/40',
  ].join(' '),
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  disabled,
  children,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'transition-all duration-200 ease-bounce',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-elev-1',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="inline-block h-4 w-4 border-2 border-current border-r-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
}
