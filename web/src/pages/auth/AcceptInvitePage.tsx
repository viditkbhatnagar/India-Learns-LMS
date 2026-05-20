import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Role } from 'india-learns-shared-types';
import { authApi } from '../../lib/endpoints.js';
import { useAuthStore } from '../../store/auth.js';
import { defaultRouteForRole } from '../../components/guards.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ApiHttpError } from '../../lib/api.js';
import { AuthLayout, AuthCard } from '../../components/AuthHero.js';

type InviteFieldErrors = Partial<Record<'password' | 'confirm' | 'token', string>>;

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // M10u — split banner-level and field-level error state.
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InviteFieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side checks first.
    if (password.length < 10) {
      setFieldErrors({ password: 'Password must be at least 10 characters.' });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const { user, accessToken } = await authApi.acceptInvite(token, password);
      setSession(user, accessToken);
      navigate(defaultRouteForRole(user.role as Role), { replace: true });
    } catch (err) {
      if (err instanceof ApiHttpError) {
        const details = err.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        const fe = details?.fieldErrors;
        if (fe && Object.keys(fe).length > 0) {
          setFieldErrors({
            password: fe.password?.[0],
            token: fe.token?.[0],
          });
          setFormError('Please fix the highlighted fields below.');
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Invite acceptance failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid invite link">
        <AuthCard>
          <p className="text-ink">
            The invite link is missing its token. Please use the button in your invite email.
          </p>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome to India Learns"
      subtitle="Set your password to finish creating your account."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="password"
            label="Choose a password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 10 characters, with a letter and a digit."
            required
            autoFocus
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          <Input
            type="password"
            label="Confirm password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            error={fieldErrors.confirm}
          />
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm animate-fade-in"
            >
              {formError}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create my account
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
