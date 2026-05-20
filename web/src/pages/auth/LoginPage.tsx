import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../../store/auth.js';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ApiHttpError } from '../../lib/api.js';
import { defaultRouteForRole } from '../../components/guards.js';
import { AuthLayout, AuthCard } from '../../components/AuthHero.js';

type LoginFieldErrors = Partial<Record<'email' | 'password' | 'deviceId', string>>;

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // M10u — split banner-level and field-level error state so we can render
  // inline messages on Email / Password instead of one opaque banner.
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const { user, accessToken } = await authApi.login(email, password);
      setSession(user, accessToken);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? defaultRouteForRole(user.role as Role), { replace: true });
    } catch (err) {
      if (err instanceof ApiHttpError) {
        const details = err.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        const fe = details?.fieldErrors;
        if (fe && Object.keys(fe).length > 0) {
          setFieldErrors({
            email: fe.email?.[0],
            password: fe.password?.[0],
            deviceId: fe.deviceId?.[0],
          });
          setFormError('Please fix the highlighted fields below.');
        } else {
          // HttpError path — server-supplied human message (e.g. 401
          // "Invalid email or password" or 423 "Account locked").
          setFormError(err.message);
        }
      } else {
        setFormError('Unable to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your India Learns portal.">
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            type="email"
            name="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
            error={fieldErrors.email}
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
            error={fieldErrors.password}
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
            Sign in
          </Button>
        </form>
        <div className="mt-5 text-sm text-center">
          <Link
            to="/forgot-password"
            className="text-brand-navy hover:text-brand-orange transition-colors font-medium"
          >
            Forgot your password?
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
