import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Card } from '../../components/ui/Card.js';

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

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card>
          {sent ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-brand-navy">Check your inbox</h1>
              <p className="text-muted mt-2">
                If an account exists for <strong>{email}</strong> you will receive an
                email with reset instructions within a few minutes.
              </p>
              <Link to="/login" className="inline-block mt-6 text-brand-orange hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <h1 className="text-xl font-bold text-brand-navy">Reset your password</h1>
              <p className="text-muted text-sm">
                Enter the email you use for India Learns and we&apos;ll send a reset link.
              </p>
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-brand-orange hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
