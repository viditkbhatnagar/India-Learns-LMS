import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NOTIFICATION_TYPES } from 'india-learns-shared-types';
import { authApi, notificationsApi, programsApi, usersApi } from '../lib/endpoints.js';
import { useAuthStore } from '../store/auth.js';
import { Card, CardHeader } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input, TextArea } from '../components/ui/Input.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton, ErrorAlert } from '../components/ui/States.js';
import { ApiHttpError } from '../lib/api.js';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  // Re-fetch the current user fresh so we have address + latest server state
  // — useAuthStore only has what was frozen at login time.
  const meQ = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => authApi.me(),
    enabled: Boolean(user),
  });
  const programsQ = useQuery({ queryKey: ['programs'], queryFn: programsApi.list });
  const programName = (() => {
    if (!meQ.data?.programId) return null;
    return programsQ.data?.find((p) => p.id === meQ.data!.programId)?.name ?? null;
  })();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Seed form state whenever we load/re-fetch the user.
  useEffect(() => {
    if (!meQ.data) return;
    setName(meQ.data.name);
    setPhone(meQ.data.phoneE164);
    setAddress(meQ.data.address ?? '');
  }, [meQ.data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        name,
        phoneE164: phone,
        address: address.trim() ? address.trim() : null,
      }),
    onSuccess: (updated) => {
      setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
      if (token) setSession(updated, token);
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
    onError: (err) =>
      setProfileMsg({
        kind: 'err',
        text: err instanceof ApiHttpError ? err.message : 'Failed to update profile.',
      }),
  });

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
  if (meQ.isLoading) return <Skeleton variant="card" />;
  const me = meQ.data ?? user;
  const firstInitial = me.name.trim().charAt(0).toUpperCase();

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
            <p className="font-semibold text-lg text-brand-navy truncate">{me.name}</p>
            <p className="text-sm text-muted truncate">{me.email}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge tone="info" dot>
                {me.role}
              </Badge>
              {me.code && <span className="text-xs font-mono text-muted">{me.code}</span>}
              {programName && <Badge tone="accent" dot>{programName}</Badge>}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-y-2.5 text-sm border-t border-black/5 pt-4">
          <dt className="text-muted">Status</dt>
          <dd className="capitalize">{me.status}</dd>
          {me.enrolmentValidFrom && me.enrolmentValidTo && (
            <>
              <dt className="text-muted">Enrolment window</dt>
              <dd>
                {new Date(me.enrolmentValidFrom).toLocaleDateString()} –{' '}
                {new Date(me.enrolmentValidTo).toLocaleDateString()}
              </dd>
            </>
          )}
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Personal details"
          subtitle="Update your contact information. Email is fixed — contact admin to change it."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setProfileMsg(null);
            saveProfile.mutate();
          }}
          className="space-y-4"
        >
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
          />
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919812345678"
            hint="E.164 format (country code + digits)"
            required
          />
          <TextArea
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Building / street / city / pin"
            rows={3}
          />
          {profileMsg && (
            <div
              role={profileMsg.kind === 'ok' ? 'status' : 'alert'}
              className={`rounded-xl p-3 text-sm ${
                profileMsg.kind === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-success'
                  : 'bg-red-50 border border-danger/30 text-danger'
              }`}
            >
              {profileMsg.text}
            </div>
          )}
          <Button type="submit" loading={saveProfile.isPending}>
            Save changes
          </Button>
        </form>
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
