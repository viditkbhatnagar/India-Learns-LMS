import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../../store/auth.js';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Card } from '../../components/ui/Card.js';
import { ApiHttpError } from '../../lib/api.js';
import { defaultRouteForRole } from '../../components/guards.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, accessToken } = await authApi.login(email, password);
      setSession(user, accessToken);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? defaultRouteForRole(user.role as Role), { replace: true });
    } catch (err) {
      if (err instanceof ApiHttpError) {
        setError(err.message);
      } else {
        setError('Unable to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-brand-orange text-brand-navy grid place-items-center font-extrabold">IL</div>
          <h1 className="mt-4 text-2xl font-bold text-brand-navy">Sign in to India Learns</h1>
          <p className="text-muted text-sm mt-1">LUC Diploma Programs — Student & Staff portal</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="email"
              name="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            <Input
              type="password"
              name="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && (
              <div className="rounded-lg border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>
          <div className="mt-6 text-sm text-center">
            <Link to="/forgot-password" className="text-brand-orange hover:underline">
              Forgot your password?
            </Link>
          </div>
        </Card>
        <p className="text-muted text-xs text-center mt-6">
          © 2026 LUC / India Learns. All rights reserved.
        </p>
      </div>
    </main>
  );
}
