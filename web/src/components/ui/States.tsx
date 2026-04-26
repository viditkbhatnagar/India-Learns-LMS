import { Component, type PropsWithChildren, type ReactNode } from 'react';
import clsx from 'clsx';
import { Button } from './Button.js';
import { captureException } from '../../lib/sentry.js';
import { ApiHttpError } from '../../lib/api.js';

export function Skeleton({
  className,
  lines = 3,
  variant = 'lines',
}: {
  className?: string;
  lines?: number;
  variant?: 'lines' | 'card';
}) {
  if (variant === 'card') {
    return (
      <div className={clsx('space-y-4', className)}>
        <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-elev-1">
          <div className="h-4 w-1/3 rounded skeleton-shimmer mb-3" />
          <div className="h-3 w-1/2 rounded skeleton-shimmer mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={clsx('space-y-2.5 animate-fade-in', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded skeleton-shimmer"
          style={{ width: `${55 + ((i * 13) % 40)}%` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-in-up">
      <div className="mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-orange-50 border border-orange-100 text-brand-orange">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <h3 className="text-brand-navy font-semibold text-lg tracking-tight">{title}</h3>
      {message && <p className="mt-2 text-muted text-sm max-w-md leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h18M3 12h18M3 17h12" />
    </svg>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger/30 bg-red-50 text-danger p-4 sm:p-5 flex items-start justify-between gap-4 animate-fade-in"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          aria-hidden
          className="mt-0.5 shrink-0 grid place-items-center h-8 w-8 rounded-full bg-white text-danger border border-danger/20"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h0" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-semibold">Something went wrong</p>
          <p className="text-sm opacity-90 mt-0.5 break-words">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Renders the right empty-state vs alert variant based on the error
 * shape — purpose-built for `useQuery({...}).error`. ApiHttpError with
 * 403 / 404 (plus the dedicated codes FORBIDDEN, NOT_ENROLLED,
 * SUSPENDED_ACCESS, ENROLMENT_EXPIRED, OVERSIGHT_READONLY) renders the
 * calm `EmptyState` so users aren't alarmed by what is usually a
 * permissions or lifecycle thing. 5xx and other failures fall back to
 * the red `ErrorAlert` banner.
 *
 * Usage:
 *   if (q.isError) {
 *     return <RequestErrorState error={q.error} onRetry={() => q.refetch()} />;
 *   }
 */
export function RequestErrorState({
  error,
  onRetry,
  title,
  action,
}: {
  error: unknown;
  onRetry?: () => void;
  /** Override title when the default is too generic for context. */
  title?: string;
  /** Custom CTA shown next to the empty-state message (e.g. a back link). */
  action?: ReactNode;
}) {
  if (error instanceof ApiHttpError) {
    const isClientError = error.status >= 400 && error.status < 500;
    const isPermissionish = error.status === 403 || error.status === 404
      || error.code === 'FORBIDDEN'
      || error.code === 'NOT_ENROLLED'
      || error.code === 'NOT_FOUND'
      || error.code === 'SUSPENDED_ACCESS'
      || error.code === 'ENROLMENT_EXPIRED'
      || error.code === 'OVERSIGHT_READONLY';
    if (isClientError && isPermissionish) {
      const headline = title ?? (error.status === 404 ? 'Not available' : 'Access paused');
      return (
        <EmptyState
          title={headline}
          message={error.message || 'You don\'t have access to this resource right now.'}
          action={action}
        />
      );
    }
  }
  const message = error instanceof Error ? error.message : 'Request failed.';
  return <ErrorAlert message={message} onRetry={onRetry} />;
}

export function Placeholder({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-navy-100 bg-white/60 p-8 text-center">
      <p className="text-sm font-semibold text-brand-navy">{title}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  // eslint-disable-next-line class-methods-use-this
  override componentDidCatch(error: Error): void {
    captureException(error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="p-8">
          <ErrorAlert message={this.state.error.message} onRetry={this.reset} />
        </div>
      );
    }
    return this.props.children;
  }
}
