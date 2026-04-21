import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Card } from '../../components/ui/Card.js';
import { ApiHttpError } from '../../lib/api.js';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
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
      await authApi.confirmPasswordReset(token, password);
      navigate('/login?reset=ok', { replace: true });
    } catch (err) {
      setError(err instanceof ApiHttpError ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
        <Card className="max-w-md">
          <h1 className="text-xl font-bold text-brand-navy">Link invalid</h1>
          <p className="text-muted mt-2">
            This reset link is missing its token. Please use the button from your
            email or request a new link.
          </p>
          <Link to="/forgot-password" className="inline-block mt-4 text-brand-orange hover:underline">
            Request a new link
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-xl font-bold text-brand-navy">Set a new password</h1>
            <Input
              type="password"
              label="New password"
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
            <Button type="submit" loading={loading} className="w-full">
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
