import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { usersApi } from '../../lib/endpoints.js';

export function FinanceStudentsPage() {
  const [q, setQ] = useState('');
  const usersQ = useQuery({
    queryKey: ['finance', 'students', q],
    queryFn: () => usersApi.list({ role: 'student', q }),
    enabled: q.length === 0 || q.length >= 2,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Students</h1>
        <p className="text-muted text-sm mt-1">Look up a student's fee position before recording a payment.</p>
      </div>
      <Card>
        <Input
          label="Search"
          placeholder="Name, email, or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </Card>
      <Card>
        {usersQ.isLoading && <Skeleton lines={4} />}
        {usersQ.isError && <ErrorAlert message={(usersQ.error as Error).message} />}
        {usersQ.data &&
          (usersQ.data.length === 0 ? (
            <EmptyState title="No students" message="Try a different search." />
          ) : (
            <ul className="divide-y divide-black/5">
              {usersQ.data.map((u) => (
                <li key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/finance/students/${u.id}`} className="font-medium text-brand-navy hover:underline">
                      {u.name}
                    </Link>
                    <p className="text-xs text-muted">{u.email}{u.code && <> · <span className="font-mono">{u.code}</span></>}</p>
                  </div>
                  <Badge tone={u.status === 'active' ? 'success' : 'warning'}>{u.status}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
