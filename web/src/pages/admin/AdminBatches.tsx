import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, ErrorAlert, Skeleton } from '../../components/ui/States.js';
import { batchesApi, programsApi } from '../../lib/endpoints.js';
import { apiErrorMessage } from '../../lib/api.js';

export function AdminBatchesPage() {
  const qc = useQueryClient();
  const batchesQ = useQuery({ queryKey: ['admin', 'batches'], queryFn: batchesApi.list });
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });

  const [name, setName] = useState('');
  const [programId, setProgramId] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => batchesApi.create({ name, programId, capacity, startDate, endDate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'batches'] });
      setName('');
      setEndDate('');
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not create the batch.')),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Batches</h1>
        <p className="text-muted text-sm mt-1">Each batch caps at 30 students by default.</p>
      </div>

      <Card>
        <CardHeader title="Create batch" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name || !programId) return setError('Please enter a name and pick a program.');
            if (!startDate) return setError('Please pick a Start date.');
            if (!endDate) return setError('Please pick an End date (all three of day, month and year).');
            if (endDate <= startDate) return setError('End date must be after the Start date.');
            return create.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <label className="block">
            <span className="block text-sm font-medium text-brand-navy mb-1.5">Program</span>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white hover:border-black/20 focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange transition-all"
              required
            >
              <option value="">Select…</option>
              {(programsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Capacity"
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="End date"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
          <div className="sm:col-span-2 flex justify-between items-center">
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" loading={create.isPending} className="ml-auto">
              Create
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Existing batches" />
        {batchesQ.isLoading && <Skeleton lines={3} />}
        {batchesQ.isError && <ErrorAlert message={(batchesQ.error as Error).message} />}
        {batchesQ.data &&
          (batchesQ.data.length === 0 ? (
            <EmptyState title="No batches yet" />
          ) : (
            <ul className="divide-y divide-black/5">
              {(batchesQ.data as Array<Record<string, unknown>>).map((b) => (
                <li key={String(b.id)} className="py-3 flex items-center justify-between">
                  <div>
                    <Link to={`/admin/batches/${String(b.id)}`} className="font-medium text-brand-navy hover:underline">
                      {String(b.name)}
                    </Link>
                    <p className="text-xs text-muted">
                      capacity {String(b.capacity)} · {String(b.status)}
                    </p>
                  </div>
                  <Badge tone={b.status === 'active' ? 'success' : 'neutral'}>{String(b.status)}</Badge>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
