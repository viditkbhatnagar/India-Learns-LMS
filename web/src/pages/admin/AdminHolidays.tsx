import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HolidayDto } from 'india-learns-shared-types';
import { Card, CardHeader } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { EmptyState, Skeleton } from '../../components/ui/States.js';
import { holidaysApi, holidaysApiAdmin } from '../../lib/endpoints.js';
import { formatIstDate } from '../../lib/format.js';

export function AdminHolidaysPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['holidays'], queryFn: holidaysApi.list });
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => holidaysApiAdmin.create({ date, name }),
    onSuccess: () => {
      setDate('');
      setName('');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const del = useMutation({
    mutationFn: (id: string) => holidaysApiAdmin.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display-sm text-brand-navy tracking-tight">Holidays</h1>
        <p className="text-muted text-sm mt-1">
          Public holidays mute timetable + fee notifications and adjust SLA business-day clocks.
        </p>
      </div>
      <Card>
        <CardHeader title="Add holiday" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!date || !name) return setError('Date and name required.');
            create.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex items-end">
            <Button type="submit" loading={create.isPending}>Add</Button>
          </div>
          {error && <p className="text-danger text-sm sm:col-span-3">{error}</p>}
        </form>
      </Card>
      <Card>
        <CardHeader title="Existing holidays" />
        {q.isLoading && <Skeleton lines={3} />}
        {q.data &&
          (q.data.length === 0 ? (
            <EmptyState title="No holidays" />
          ) : (
            <ul className="divide-y divide-black/5">
              {q.data.map((h: HolidayDto) => (
                <li key={h.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-brand-navy">{h.name}</p>
                    <p className="text-xs text-muted">{formatIstDate(h.date)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={del.isPending}
                    onClick={() => {
                      if (confirm('Remove this holiday?')) del.mutate(h.id);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ))}
      </Card>
    </div>
  );
}
