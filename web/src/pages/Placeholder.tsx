import { Card } from '../components/ui/Card.js';
import { EmptyState } from '../components/ui/States.js';

export function Placeholder({ title, message }: { title: string; message?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
      <Card>
        <EmptyState
          title="Coming in M9"
          message={message ?? 'This screen is backed by a working API today; the full UI ships with the M9 polish pass. Use the API directly or check the admin dashboard for aggregate data.'}
        />
      </Card>
    </div>
  );
}
