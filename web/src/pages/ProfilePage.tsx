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
  const firstInitial = user.name.trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Account
        </p>
        <h1 className="text-display-sm text-brand-navy">My profile</h1>
      </header>

      <Card accent="navy">
        <div className="flex items-center gap-4 mb-6">
          <div
            aria-hidden
            className="shrink-0 h-16 w-16 rounded-2xl bg-accent-gradient text-white font-bold text-2xl grid place-items-center shadow-glow-orange"
          >
            {firstInitial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-lg text-brand-navy truncate">{user.name}</p>
            <p className="text-sm text-muted truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge tone="info" dot>
                {user.role}
              </Badge>
              {user.code && (
                <span className="text-xs font-mono text-muted">{user.code}</span>
              )}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-y-2.5 text-sm border-t border-black/5 pt-4">
          {user.phoneE164 && (
            <>
              <dt className="text-muted">Phone</dt>
              <dd className="font-mono">{user.phoneE164}</dd>
            </>
          )}
          <dt className="text-muted">Status</dt>
          <dd className="capitalize">{user.status}</dd>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Change password" subtitle="Minimum 10 characters, with a letter and a digit." />
        <form onSubmit={onChangePassword} className="space-y-4">
          <Input
            type="password"
            label="Current password"
            placeholder="••••••••"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            type="password"
            label="New password"
            placeholder="••••••••"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            hint="Minimum 10 characters."
          />
          {msg && (
            <div
              role="status"
              className={`rounded-xl p-3 text-sm ${
                msg.kind === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-success'
                  : 'bg-red-50 border border-danger/30 text-danger'
              }`}
            >
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

  if (query.isLoading) return <Skeleton variant="card" />;
  if (query.isError) {
    return <ErrorAlert message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const prefs = query.data!;

  const WHATSAPP_ALLOWLIST = new Set([
    'fees.upcoming.7d', 'fees.due.today', 'fees.warning.1', 'fees.warning.2',
    'fees.suspended', 'fees.paid', 'ticket.state_changed',
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
          Account
        </p>
        <h1 className="text-display-sm text-brand-navy">Notification preferences</h1>
        <p className="mt-2 text-muted">
          In-app notifications are always on. Toggle email per event, and WhatsApp for the pre-approved templates.
        </p>
      </header>

      <Card>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-muted text-[11px] uppercase tracking-wider font-bold border-b border-black/5">
                <th className="py-3 pr-4">Event</th>
                <th className="py-3 pr-4">In-app</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-2">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {NOTIFICATION_TYPES.map((t) => {
                const waEligible = WHATSAPP_ALLOWLIST.has(t);
                return (
                  <tr key={t} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-brand-navy font-mono text-xs">
                      {t}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone="success" dot size="sm">
                        On
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Toggle
                        checked={prefs.emailByType[t] ?? true}
                        onChange={(v) => update.mutate({ emailByType: { [t]: v } })}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      {waEligible ? (
                        <Toggle
                          checked={prefs.whatsappByType[t] ?? false}
                          onChange={(v) => update.mutate({ whatsappByType: { [t]: v } })}
                        />
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
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm"
          >
            {(update.error as Error).message}
          </div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30 focus-visible:ring-offset-2 ${
        checked ? 'bg-accent-gradient shadow-glow-orange' : 'bg-muted/40'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
