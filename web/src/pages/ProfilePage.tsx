import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NOTIFICATION_TYPES } from 'india-learns-shared-types';
import { authApi, notificationsApi } from '../lib/endpoints.js';
import { useAuthStore } from '../store/auth.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert } from '../components/ui/States.js';
import { ApiHttpError } from '../lib/api.js';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await authApi.changePassword(current, next);
      setMsg({ kind: 'ok', text: 'Password updated.' });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Failed to update password.',
      });
    }
  }

  if (!user) return null;
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-navy">My profile</h1>
      <Card>
        <CardHeader title="Account" />
        <dl className="grid grid-cols-[1fr_2fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt><dd>{user.name}</dd>
          <dt className="text-muted">Email</dt><dd>{user.email}</dd>
          <dt className="text-muted">Role</dt><dd className="capitalize">{user.role}</dd>
          {user.code && <><dt className="text-muted">Code</dt><dd className="mono">{user.code}</dd></>}
        </dl>
      </Card>
      <Card>
        <CardHeader title="Change password" />
        <form onSubmit={onChangePassword} className="space-y-3">
          <Input type="password" label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <Input type="password" label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" hint="Minimum 10 characters." />
          {msg && (
            <div className={`rounded-lg p-3 text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-success' : 'bg-red-50 border border-danger/30 text-danger'}`}>
              {msg.text}
            </div>
          )}
          <Button type="submit">Update password</Button>
        </form>
      </Card>
    </div>
  );
}

export function NotificationPrefsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['me', 'notification-prefs'], queryFn: notificationsApi.getPrefs });
  const update = useMutation({
    mutationFn: notificationsApi.updatePrefs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notification-prefs'] }),
  });

  if (query.isLoading) return <Skeleton lines={6} />;
  if (query.isError) return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const prefs = query.data!;

  const WHATSAPP_ALLOWLIST = new Set([
    'fees.upcoming.7d', 'fees.due.today', 'fees.warning.1', 'fees.warning.2',
    'fees.suspended', 'fees.paid', 'ticket.state_changed',
  ]);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-navy">Notification preferences</h1>
      <p className="text-muted text-sm">
        In-app notifications are always on. Toggle email per event, and WhatsApp for the three
        pre-approved templates.
      </p>
      <Card>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="text-left text-muted text-xs uppercase border-b border-black/5">
              <tr>
                <th className="py-2 px-2">Event</th>
                <th className="py-2 px-2">In-app</th>
                <th className="py-2 px-2">Email</th>
                <th className="py-2 px-2">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {NOTIFICATION_TYPES.map((t) => {
                const waEligible = WHATSAPP_ALLOWLIST.has(t);
                return (
                  <tr key={t}>
                    <td className="py-2 px-2 font-medium text-brand-navy">{t}</td>
                    <td className="py-2 px-2"><Badge tone="success">On</Badge></td>
                    <td className="py-2 px-2">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-black/20 text-brand-orange focus:ring-brand-orange"
                          checked={prefs.emailByType[t] ?? true}
                          onChange={(e) => update.mutate({ emailByType: { [t]: e.target.checked } })}
                        />
                      </label>
                    </td>
                    <td className="py-2 px-2">
                      {waEligible ? (
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-black/20 text-brand-orange focus:ring-brand-orange"
                            checked={prefs.whatsappByType[t] ?? false}
                            onChange={(e) => update.mutate({ whatsappByType: { [t]: e.target.checked } })}
                          />
                        </label>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {update.isError && (
          <div className="mt-3 rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">
            {(update.error as Error).message}
          </div>
        )}
      </Card>
    </div>
  );
}
