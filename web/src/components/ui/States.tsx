import { Component, type PropsWithChildren, type ReactNode } from 'react';
import { Button } from './Button.js';

export function Skeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={className ?? 'space-y-2'}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-brand-cream rounded animate-pulse"
          style={{ width: `${60 + (i % 3) * 15}%` }}
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
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className="mb-3 text-brand-orange">{icon}</div>}
      <h3 className="text-brand-navy font-semibold text-lg">{title}</h3>
      {message && <p className="mt-1 text-muted text-sm max-w-md">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">Something went wrong</p>
        <p className="text-sm opacity-90 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
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
