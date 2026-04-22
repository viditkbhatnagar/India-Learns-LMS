import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';

export function OfflinePage() {
  return (
    <div className="min-h-screen grid place-items-center bg-brand-cream p-6">
      <div className="max-w-md text-center bg-white rounded-2xl p-8 shadow-sm">
        <div className="mx-auto h-16 w-16 grid place-items-center rounded-2xl bg-brand-navy text-brand-orange font-extrabold text-2xl mb-4">
          IL
        </div>
        <h1 className="text-2xl font-semibold text-brand-navy">You're offline</h1>
        <p className="mt-2 text-muted">
          India Learns can't reach the network right now. Previously-loaded pages
          still work; try again when you're back online.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => location.reload()}>Retry</Button>
          <Link
            to="/"
            className="text-sm text-brand-navy underline-offset-4 hover:underline"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
