import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-orange text-brand-navy hover:bg-orange-600 focus-visible:ring-brand-orange',
  secondary: 'bg-white text-brand-navy border border-brand-navy/20 hover:bg-brand-cream focus-visible:ring-brand-navy/30',
  ghost: 'bg-transparent text-brand-navy hover:bg-brand-navy/5 focus-visible:ring-brand-navy/20',
  danger: 'bg-danger text-white hover:bg-red-700 focus-visible:ring-danger/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
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
