import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name ?? Math.random().toString(36).slice(2);
    return (
      <label htmlFor={inputId} className="block">
        {label && (
          <span className="block text-sm font-medium text-brand-navy mb-1.5">{label}</span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={clsx(
            'w-full h-10 px-3 rounded-lg border bg-white text-ink',
            'focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange',
            error ? 'border-danger' : 'border-black/10',
            'disabled:bg-brand-cream disabled:cursor-not-allowed',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
        {!error && hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
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
          <span className="block text-sm font-medium text-brand-navy mb-1.5">{label}</span>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border bg-white text-ink',
            'focus:outline-none focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange',
            error ? 'border-danger' : 'border-black/10',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <span className="mt-1 block text-sm text-danger">{error}</span>}
        {!error && hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
      </label>
    );
  },
);
TextArea.displayName = 'TextArea';
