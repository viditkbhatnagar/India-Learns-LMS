import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// Focus ring uses navy (higher contrast on cream / white) rather than brand
// orange to stay WCAG-friendly against every page background. Border on
// focus still tints orange for brand recognition.

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name ?? Math.random().toString(36).slice(2);
    return (
      <label htmlFor={inputId} className="block">
        {label && (
          <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
            {label}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            'w-full h-11 px-3.5 rounded-xl border bg-white text-ink placeholder:text-muted',
            'transition-all duration-150',
            'focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange',
            error
              ? 'border-danger/60 focus:border-danger focus:ring-danger/15'
              : 'border-black/10 hover:border-black/20',
            'disabled:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <span className="mt-1.5 block text-sm text-danger">{error}</span>}
        {!error && hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
      </label>
    );
  },
);
Input.displayName = 'Input';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className, id, rows = 4, ...rest }, ref) => {
    const inputId = id ?? rest.name ?? Math.random().toString(36).slice(2);
    return (
      <label htmlFor={inputId} className="block">
        {label && (
          <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
            {label}
          </span>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={clsx(
            'w-full px-3.5 py-2.5 rounded-xl border bg-white text-ink placeholder:text-muted',
            'transition-all duration-150',
            'focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange',
            error
              ? 'border-danger/60 focus:border-danger focus:ring-danger/15'
              : 'border-black/10 hover:border-black/20',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <span className="mt-1.5 block text-sm text-danger">{error}</span>}
        {!error && hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
      </label>
    );
  },
);
TextArea.displayName = 'TextArea';
