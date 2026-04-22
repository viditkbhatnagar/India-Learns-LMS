import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../../store/auth.js';
import { authApi } from '../../lib/endpoints.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
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
    <main className="min-h-screen grid lg:grid-cols-[1.1fr,1fr]">
      {/* Left — brand hero panel. Hidden on mobile to keep the form front-and-
          centre, becomes the showpiece on laptop/desktop. */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex relative overflow-hidden items-center justify-center p-12 bg-brand-gradient text-white"
      >
        <div className="absolute inset-0 opacity-30 bg-hero-radial" />
        <div className="relative z-10 max-w-md animate-fade-in-up">
          <img
            src="/brand/logo.jpg"
            alt=""
            className="h-16 w-auto rounded-lg shadow-elev-3 mb-10"
          />
          <h2 className="text-display-md text-white leading-tight">
            Every class, every assignment, every certificate — in one place.
          </h2>
          <p className="mt-5 text-white/80 leading-relaxed">
            India Learns is the learning platform for Diploma Programs.
            Students, faculty, and admin stay in sync without chasing email.
          </p>
          <ul className="mt-10 space-y-4 text-white/90 text-sm">
            <FeatureLi>Live timetables · recorded content · quizzes + exams</FeatureLi>
            <FeatureLi>Integrated fees · receipts · payment tracking</FeatureLi>
            <FeatureLi>Verifiable Certifier.io certificates on course completion</FeatureLi>
            <FeatureLi>DPDP 2023 compliant · hosted in India</FeatureLi>
          </ul>
        </div>
      </aside>

      {/* Right — sign-in card. */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Mobile-only compact header. */}
          <div className="lg:hidden text-center mb-6">
            <img src="/brand/logo.jpg" alt="India Learns" className="mx-auto h-14 w-auto" />
          </div>

          <div className="mb-8">
            <h1 className="text-display-sm text-brand-navy">Welcome back</h1>
            <p className="text-muted mt-2">
              Sign in to continue to your India Learns portal.
            </p>
          </div>

          <div className="rounded-2xl bg-white shadow-elev-3 border border-black/5 p-7">
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
          </div>

          <p className="text-muted text-xs text-center mt-8">
            © 2026 India Learns. All rights reserved.
          </p>
        </div>
      </section>
    </main>
  );
}

function FeatureLi({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-white text-[10px] font-bold shadow-glow-orange"
      >
        ✓
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
