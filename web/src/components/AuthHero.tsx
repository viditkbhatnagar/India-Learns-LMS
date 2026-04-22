import type { PropsWithChildren } from 'react';

/**
 * Shared split-screen hero panel for every auth route (Login, Forgot, Reset,
 * AcceptInvite). Left panel renders the brand gradient + feature copy;
 * right panel is whatever the page passes as children.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr,1fr]">
      <aside
        aria-hidden="true"
        className="hidden lg:flex relative overflow-hidden items-center justify-center p-12 bg-brand-gradient text-white"
      >
        <div className="absolute inset-0 opacity-30 bg-hero-radial" />
        <div className="relative z-10 max-w-md animate-fade-in-up">
          <img
            src="/brand/logo.jpg"
            alt=""
            className="h-16 w-auto rounded-lg shadow-elev-3 mb-10"
          />
          <h2 className="text-display-md text-white leading-tight">
            Every class, every assignment, every certificate — in one place.
          </h2>
          <p className="mt-5 text-white/80 leading-relaxed">
            India Learns is the learning platform for Diploma Programs.
            Students, faculty, and admin stay in sync without chasing email.
          </p>
          <ul className="mt-10 space-y-4 text-white/90 text-sm">
            <FeatureLi>Live timetables · recorded content · quizzes + exams</FeatureLi>
            <FeatureLi>Integrated fees · receipts · payment tracking</FeatureLi>
            <FeatureLi>Verifiable Certifier.io certificates on course completion</FeatureLi>
            <FeatureLi>DPDP 2023 compliant · hosted in India</FeatureLi>
          </ul>
        </div>
      </aside>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="lg:hidden text-center mb-6">
            <img src="/brand/logo.jpg" alt="India Learns" className="mx-auto h-14 w-auto" />
          </div>
          {(title || subtitle) && (
            <div className="mb-8">
              {title && <h1 className="text-display-sm text-brand-navy">{title}</h1>}
              {subtitle && <p className="text-muted mt-2">{subtitle}</p>}
            </div>
          )}
          {children}
          <p className="text-muted text-xs text-center mt-8">
            © 2026 India Learns. All rights reserved.
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white text-[10px] font-bold shadow-glow-orange"
      >
        ✓
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

export function AuthCard({ children }: PropsWithChildren) {
  return (
    <div className="rounded-2xl bg-white shadow-elev-3 border border-black/5 p-7">
      {children}
    </div>
  );
}
