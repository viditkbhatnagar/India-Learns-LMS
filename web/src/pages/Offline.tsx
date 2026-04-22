import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';

export function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl p-8 sm:p-10 shadow-elev-3 border border-black/5 animate-fade-in-up">
        <img
          src="/brand/logo.jpg"
          alt=""
          aria-hidden
          className="mx-auto h-16 w-auto rounded-xl shadow-elev-1 mb-5"
        />
        <div
          aria-hidden
          className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-amber-50 border border-amber-200 text-warning mb-4"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <path d="M1.5 12A14.5 14.5 0 0 1 23 12" />
            <path d="M5 16a8 8 0 0 1 14 0" />
            <path d="M8.5 19.5a4 4 0 0 1 7 0" />
            <circle cx="12" cy="22" r="0.5" />
            <path d="m2 2 20 20" />
          </svg>
        </div>
        <h1 className="text-display-sm text-brand-navy">You're offline</h1>
        <p className="mt-3 text-muted leading-relaxed">
          India Learns can't reach the network right now. Previously-loaded pages still work; try again when you're back online.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Button onClick={() => location.reload()} size="lg">
            Retry connection
          </Button>
          <Link
            to="/"
            className="text-sm text-brand-navy hover:text-brand-orange font-medium transition-colors"
          >
            Go home →
          </Link>
        </div>
      </div>
    </div>
  );
}
