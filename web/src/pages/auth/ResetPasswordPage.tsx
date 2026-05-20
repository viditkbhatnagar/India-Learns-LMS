import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { ApiHttpError } from '../../lib/api.js';
import { AuthLayout, AuthCard } from '../../components/AuthHero.js';

type ResetFieldErrors = Partial<Record<'password' | 'confirm' | 'token', string>>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // M10u — split banner-level and field-level error state.
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ResetFieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Client-side checks land as inline errors first.
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
      await authApi.confirmPasswordReset(token, password);
      navigate('/login?reset=ok', { replace: true });
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
        setFormError('Reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link invalid" subtitle="This reset link can't be used.">
        <AuthCard>
          <p className="text-ink">
            This reset link is missing its token. Please use the button from your email or request a new link.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block mt-5 text-brand-navy hover:text-brand-orange font-medium transition-colors"
          >
            Request a new link →
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose something strong — you'll use it to sign in from now on."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="password"
            label="New password"
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
            Update password
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
