import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { AuthLayout, AuthCard } from '../../components/AuthHero.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch {
      // Always report success — don't leak whether an email exists.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="Reset link on its way.">
        <AuthCard>
          <div className="text-center">
            <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-success mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden>
                <path d="m4 8 8 6 8-6" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
              </svg>
            </div>
            <p className="text-ink">
              If an account exists for <strong className="text-brand-navy">{email}</strong>, you'll receive an email with reset instructions within a few minutes.
            </p>
            <Link
              to="/login"
              className="inline-block mt-6 text-brand-navy hover:text-brand-orange font-medium transition-colors"
            >
              ← Back to sign in
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you use for India Learns and we'll send a reset link."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Send reset link
          </Button>
        </form>
        <div className="mt-5 text-center text-sm">
          <Link
            to="/login"
            className="text-brand-navy hover:text-brand-orange font-medium transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
