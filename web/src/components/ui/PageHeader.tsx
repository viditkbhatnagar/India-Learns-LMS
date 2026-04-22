import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Consistent page header used across all authenticated routes.
 *  - eyebrow: small uppercase orange label above the title
 *  - title:   display-sm heading in brand-navy
 *  - subtitle: muted one-liner description
 *  - action:   right-aligned CTA (button, link, etc.)
 *  - back:     optional "← Back to X" breadcrumb above the title
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  back,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 animate-fade-in-up">
      <div>
        {back && (
          <Link
            to={back.to}
            className="inline-block text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors mb-2"
          >
            ← {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="text-display-sm text-brand-navy">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
