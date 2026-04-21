import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Role } from 'india-learns-shared-types';
import { authApi } from '../../lib/endpoints.js';
import { useAuthStore } from '../../store/auth.js';
import { defaultRouteForRole } from '../../components/guards.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Card } from '../../components/ui/Card.js';
import { ApiHttpError } from '../../lib/api.js';

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { user, accessToken } = await authApi.acceptInvite(token, password);
      setSession(user, accessToken);
      navigate(defaultRouteForRole(user.role as Role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Invite acceptance failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
        <Card className="max-w-md">
          <h1 className="text-xl font-bold text-brand-navy">Invalid invite link</h1>
          <p className="text-muted mt-2">
            The invite link is missing its token. Please use the button in your invite email.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-brand-navy">Welcome to India Learns</h1>
          <p className="text-muted text-sm mt-1">Set your password to finish creating your account.</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              label="Choose a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="At least 10 characters, with a letter and a digit."
              required
              autoFocus
              autoComplete="new-password"
            />
            <Input
              type="password"
              label="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            {error && (
              <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create my account
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
