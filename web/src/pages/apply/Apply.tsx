import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApplicationState } from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { AuthCard, AuthLayout } from '../../components/AuthHero.js';
import { ApiHttpError } from '../../lib/api.js';
import { admissionsApi } from '../../lib/endpoints.js';
import { useAuthStore } from '../../store/auth.js';

// (Submit page imports Link + Button below; this file exports portal + signup
// + landing. The submit page lives in Submit.tsx.)

// M1 — Public landing for prospective applicants. Step 0 of the funnel
// (PAGE OUTLINE §4.1). Marketing copy stays placeholder until design hands
// over final assets (Q8). The CTA routes into /apply/signup.

export function ApplyLandingPage() {
  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/apply" className="flex items-center gap-3">
            <img
              src="/brand/logo.jpg"
              alt="India Learns"
              className="h-10 w-auto rounded-md"
            />
            <span className="text-brand-navy font-bold">India Learns</span>
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-brand-navy hover:text-brand-orange transition-colors"
          >
            Resume application →
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-24 animate-fade-in-up">
        <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-3">
          Admissions are open
        </p>
        <h1 className="text-display-lg text-brand-navy leading-[1.1]">
          Apply to an India Learns Diploma Program.
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl">
          One short application. Save your progress as you go. Hear back from
          our admissions team within a couple of weeks of submission.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link to="/apply/signup">
            <Button size="lg">Start application</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="secondary">
              Resume application
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20 grid sm:grid-cols-3 gap-6">
        <FeatureCard
          eyebrow="Step 1"
          title="Create your account"
          body="Email + password. Used to save your draft and check status later."
        />
        <FeatureCard
          eyebrow="Step 2"
          title="Tell us about you"
          body="Personal, contact, academic background. Upload supporting documents."
        />
        <FeatureCard
          eyebrow="Step 3"
          title="Submit and track"
          body="Confirmation email, application code, status tracking in your portal."
        />
      </section>

      <footer className="border-t border-black/5 py-6 text-center text-xs text-muted">
        © 2026 India Learns. All rights reserved.
      </footer>
    </main>
  );
}

function FeatureCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl bg-white shadow-elev-1 border border-black/5 p-6">
      <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
        {eyebrow}
      </p>
      <h2 className="text-brand-navy font-semibold text-lg">{title}</h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">{body}</p>
    </article>
  );
}

// Step 1 of the form (PAGE OUTLINE §4.2). M1 ships only this step — the rest
// (Personal, Contact, Program, Academic, Documents, References, Consents,
// Submit) land in M2/M3/M4 as the milestones complete.

// Server-side field names mirror the signup Zod schema in api/src/routes/admissions/admissions.ts.
// `confirm` is client-only — the backend has no idea about it.
type SignupFieldKey = 'name' | 'email' | 'phoneE164' | 'password' | 'confirm';
type SignupFieldErrors = Partial<Record<SignupFieldKey, string>>;

export function ApplySignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [commsOptIn, setCommsOptIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match.' });
      setFormError('Please fix the highlighted field below.');
      return;
    }
    setLoading(true);
    try {
      const result = await admissionsApi.signup({
        name,
        email,
        phoneE164: phone,
        password,
        commsOptIn,
      });
      // The signup response is shaped like the LMS auth login response so we
      // can reuse useAuthStore. We don't have a UserPublicDto in hand — but
      // the LMS auth store needs one, so we hydrate from the application's
      // applicant{Name,Email} + role we just created on the server.
      setSession(
        {
          id: result.application.applicantUserId,
          role: 'applicant',
          code: null,
          name,
          email,
          phoneE164: phone,
          status: 'active',
          suspensionKind: null,
          suspensionReason: null,
          lastLoginAt: new Date().toISOString(),
          programId: null,
          batchId: null,
          enrolmentValidFrom: null,
          enrolmentValidTo: null,
          deptTag: null,
          isCourseCoordinator: false,
          address: null,
          // M10 — Personal-detail fields. The applicant hasn't completed
          // Step 2/3 yet, so all four are null at signup; they get
          // populated by the time they accept an offer.
          dateOfBirth: null,
          personalAddress: null,
          emergencyContact: null,
          parentGuardian: null,
          // M10f — Placement resume URL; applicants never have one until
          // they convert to students and upload via Profile.
          resumeUrl: null,
          // M10x — Marketing source unknown for self-signup applicants.
          source: null,
          createdAt: result.application.createdAt,
          updatedAt: result.application.updatedAt,
          deletedAt: null,
        },
        result.accessToken,
      );
      navigate('/apply/portal', { replace: true });
    } catch (err) {
      if (err instanceof ApiHttpError) {
        const details = err.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined;
        const fe = details?.fieldErrors;
        const fromServer: SignupFieldErrors = {};
        if (fe) {
          const [phoneErr] = fe.phoneE164 ?? [];
          const [nameErr] = fe.name ?? [];
          const [emailErr] = fe.email ?? [];
          const [passwordErr] = fe.password ?? [];
          if (phoneErr) {
            // Zod's flattened message ("Invalid") isn't actionable for the
            // E.164 regex — replace with copy that mirrors the hint.
            fromServer.phoneE164 = 'Include the + and country code, e.g. +919876543210.';
          }
          if (nameErr) fromServer.name = nameErr;
          if (emailErr) fromServer.email = emailErr;
          if (passwordErr) fromServer.password = passwordErr;
        }
        if (Object.keys(fromServer).length > 0) {
          setFieldErrors(fromServer);
          setFormError('Please fix the highlighted fields below.');
        } else {
          // HttpError path — backend already provides an actionable message
          // (e.g. weak password from validatePolicy, or USER_EXISTS on duplicate email).
          setFormError(err.message);
        }
      } else {
        setFormError('Unable to create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Start your application"
      subtitle="Create an account so you can save your progress and come back later."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            name="name"
            label="Full name"
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
            error={fieldErrors.name}
          />
          <Input
            type="email"
            name="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            error={fieldErrors.email}
          />
          <Input
            type="tel"
            name="phoneE164"
            label="Mobile phone (with country code)"
            placeholder="+919876543210"
            pattern="^\+\d{6,15}$"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            hint="Include the + and country code."
            error={fieldErrors.phoneE164}
          />
          <Input
            type="password"
            name="password"
            label="Password"
            placeholder="At least 10 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={10}
            error={fieldErrors.password}
          />
          <Input
            type="password"
            name="confirm"
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            minLength={10}
            error={fieldErrors.confirm}
          />
          <label className="flex items-start gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              name="commsOptIn"
              checked={commsOptIn}
              onChange={(e) => setCommsOptIn(e.target.checked)}
              className="mt-1"
            />
            <span>
              Send me occasional updates about programs and admissions.
              (Optional — you'll still get application status emails either
              way.)
            </span>
          </label>
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm animate-fade-in"
            >
              {formError}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Create account
          </Button>
        </form>
        <p className="mt-5 text-sm text-center text-muted">
          Already started?{' '}
          <Link
            to="/login"
            className="text-brand-navy hover:text-brand-orange font-medium"
          >
            Resume your application
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}

// M1 portal — applicant-authenticated landing page after signup. M2+ will
// fold this into the multi-step form; for now it's a status panel.

const STATE_LABELS: Record<ApplicationState, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }> = {
  draft: { label: 'Draft — not yet submitted', tone: 'warning' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  decision_pending: { label: 'Decision pending', tone: 'info' },
  admitted: { label: 'Admitted', tone: 'success' },
  denied: { label: 'Decision: not admitted', tone: 'danger' },
  waitlisted: { label: 'Waitlisted', tone: 'warning' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function ApplyPortalPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admissions', 'me'],
    queryFn: () => admissionsApi.myApplication(),
  });
  const { data: fee } = useQuery({
    queryKey: ['admissions', 'me', 'fee'],
    queryFn: () => admissionsApi.getMyFee(),
    enabled: Boolean(data?.state) && data?.state !== 'draft',
  });
  const accept = useMutation({
    mutationFn: () => admissionsApi.acceptOffer(),
    onSuccess: (result) => {
      setActionError(null);
      // The applicant just became a student. Log them out + redirect to
      // login — they need a new session as a student.
      qc.clear();
      window.alert(
        `Welcome to India Learns! Your student ID is ${result.studentCode}. Please log in again to access your student dashboard.`,
      );
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      setActionError(err instanceof ApiHttpError ? err.message : 'Could not accept offer.');
    },
  });
  const decline = useMutation({
    mutationFn: () => admissionsApi.declineOffer(),
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['admissions', 'me'] });
    },
    onError: (err) => {
      setActionError(err instanceof ApiHttpError ? err.message : 'Could not decline.');
    },
  });

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8 animate-fade-in-up">
        <header>
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
            Your application
          </p>
          <h1 className="text-display-sm text-brand-navy">
            Welcome to India Learns
          </h1>
          <p className="mt-2 text-muted">
            Your application has been started. The full form (personal info,
            documents, references, and consents) will be available here as
            those sections roll out over the coming weeks.
          </p>
        </header>

        {isLoading && (
          <p className="text-muted">Loading your application…</p>
        )}
        {isError && (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-red-50 text-danger p-4"
          >
            {error instanceof ApiHttpError
              ? error.message
              : 'Could not load your application. Please refresh.'}
          </div>
        )}
        {data && (
          <article className="rounded-2xl bg-white shadow-elev-2 border border-black/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Application code</p>
                <p className="text-display-sm text-brand-navy">{data.code}</p>
              </div>
              <Badge tone={STATE_LABELS[data.state].tone} size="md">
                {STATE_LABELS[data.state].label}
              </Badge>
            </div>
            <dl className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Started</dt>
                <dd className="text-ink">
                  {new Date(data.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last updated</dt>
                <dd className="text-ink">
                  {new Date(data.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
            {data.state === 'draft' && (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/apply/form">
                  <Button>Continue application</Button>
                </Link>
                <Link to="/apply/submit">
                  <Button variant="secondary">Review &amp; submit</Button>
                </Link>
              </div>
            )}
            {fee && (
              <div className="mt-6 rounded-xl border border-black/5 bg-surface-muted/40 p-4">
                <p className="text-sm font-semibold text-brand-navy mb-1">
                  Application fee
                </p>
                {fee.status === 'paid' && (
                  <p className="text-sm text-success">
                    ✓ Paid (₹{(fee.amountPaise / 100).toFixed(0)}).
                    Recorded {fee.paidAt ? new Date(fee.paidAt).toLocaleString() : ''}.
                  </p>
                )}
                {fee.status === 'waived' && (
                  <p className="text-sm text-success">
                    ✓ Waived
                    {fee.waivedReason ? ` — ${fee.waivedReason}` : ''}.
                  </p>
                )}
                {fee.status === 'pending' && (
                  <>
                    <p className="text-sm text-muted">
                      Amount due: ₹{(fee.amountPaise / 100).toFixed(0)}.
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Contact admissions to pay. Once recorded, you'll see the
                      status update here.
                    </p>
                  </>
                )}
              </div>
            )}
            {data.state === 'admitted' && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800 mb-2">
                  Congratulations — you've been admitted!
                </p>
                {data.decision?.reasonApplicant && (
                  <p className="text-sm text-emerald-900 mb-3">
                    {data.decision.reasonApplicant}
                  </p>
                )}
                <p className="text-sm text-emerald-900 mb-3">
                  Accept your offer to receive your Student ID and enrol in your
                  program. You can also decline if you've changed your mind.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => accept.mutate()} loading={accept.isPending}>
                    Accept offer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm('Are you sure? You can\'t reverse this.')) {
                        decline.mutate();
                      }
                    }}
                    disabled={accept.isPending || decline.isPending}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}
            {(data.state === 'denied' || data.state === 'waitlisted' || data.state === 'withdrawn') && data.decision?.reasonApplicant && (
              <div className="mt-6 rounded-xl border border-black/10 bg-surface-muted/40 p-4 text-sm">
                {data.decision.reasonApplicant}
              </div>
            )}
            {actionError && (
              <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
                {actionError}
              </div>
            )}
            <p className="mt-6 text-sm text-muted">
              We'll email you each time the status changes.
            </p>
          </article>
        )}
      </div>
    </main>
  );
}
