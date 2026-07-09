import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEntranceAuthStore } from '../../store/entranceAuth.js';
import { entranceApi } from '../../lib/entranceApi.js';
import { ApiHttpError } from '../../lib/api.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { AuthLayout, AuthCard } from '../../components/AuthHero.js';

export function EntranceLoginPage() {
  const token = useEntranceAuthStore((s) => s.token);
  const setSession = useEntranceAuthStore((s) => s.setSession);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (token) return <Navigate to="/entrance/exam" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await entranceApi.login(phone, password);
      setSession(result.candidate, result.token);
      navigate('/entrance/exam', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiHttpError
          ? err.message
          : 'Unable to sign in. Please check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Entrance Examination"
      subtitle="Sign in with the phone number and password provided to you."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            type="tel"
            name="phone"
            label="Phone number"
            placeholder="10-digit mobile number"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="username"
            autoFocus
          />
          <Input
            type="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm animate-fade-in"
            >
              {error}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Start entrance exam
          </Button>
        </form>
        <p className="mt-5 text-xs text-center text-muted">
          Your answers are saved automatically as you go.
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
