import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';

/**
 * Onboarding shell — five static screens that walk a freshly-invited student
 * from "you got an email" to "you're in the dashboard". Each is a standalone
 * route; ordering is implicit via Continue buttons. Ports the approved mockups
 * in `webapp/screens-extras.jsx` (`OnbEmailInvite`, `OnbLanding`,
 * `OnbSetPassword`, `OnbTour`, `OnbArrival`).
 */

function BrandHeader() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <img src="/brand/logo.jpg" alt="" aria-hidden="true" className="h-10 w-auto" />
      <div>
        <p className="font-bold text-brand-navy leading-none">India Learns</p>
        <p className="text-xs text-muted">Diploma Programs</p>
      </div>
    </div>
  );
}

export function OnbEmailInvitePage() {
  return (
    <main className="min-h-screen bg-brand-cream grid place-items-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-elev-4 overflow-hidden animate-fade-in-up">
        <div className="bg-brand-cream/60 border-b border-black/5 px-5 py-3 flex items-center gap-3 text-xs text-muted">
          <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-yellow-400" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-green-500" aria-hidden />
          <span className="font-mono ml-3">mail.google.com/inbox</span>
          <span className="ml-auto">From: onboarding@indialearns.com</span>
        </div>
        <div className="p-8 sm:p-10">
          <BrandHeader />
          <h1 className="text-display-sm text-brand-navy tracking-tight">Your seat is reserved.</h1>
          <p className="text-muted mt-3 leading-relaxed text-sm">
            You've been enrolled in a diploma program at India Learns. Use the
            link below to activate your account. The link expires in 7 days.
          </p>
          <Link to="/onboarding/landing">
            <Button className="mt-6">Activate your account →</Button>
          </Link>
          <p className="mt-4 text-xs text-muted">
            If the button doesn't work, paste{' '}
            <span className="font-mono">https://app.indialearns.com/accept-invite?t=…</span>{' '}
            into your browser.
          </p>
        </div>
      </div>
    </main>
  );
}

export function OnbLandingPage() {
  return (
    <main className="min-h-screen bg-brand-cream grid place-items-center p-6">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-elev-4 overflow-hidden animate-fade-in-up grid grid-cols-1 md:grid-cols-2">
        <div className="bg-brand-navy text-white p-10 relative overflow-hidden">
          <BrandHeader />
          <h1 className="text-display-md leading-tight tracking-tight">
            Welcome to <span className="text-brand-orange">India Learns</span>.
          </h1>
          <p className="text-white/70 mt-3 text-sm leading-relaxed">
            Three quick things you should know about your learning journey with us.
          </p>
          <ul className="mt-6 space-y-4">
            <LandingPoint n="01" t="Classes, content, tests — in one place" d="Everything in your dashboard." />
            <LandingPoint n="02" t="Your data is yours" d="DPDP 2023 compliant · India-hosted · Encrypted." />
            <LandingPoint n="03" t="A Diploma that gets you hired" d="Verifiable online, recognised by our industry partners." />
          </ul>
        </div>
        <div className="p-10 flex flex-col justify-center">
          <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold">Step 01 of 03</p>
          <h2 className="text-display-sm text-brand-navy tracking-tight mt-2">Let's set up your account.</h2>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            Your admin has pre-enrolled you. You'll choose a password and we'll get you started in under 3 minutes.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <Step done>Email verified</Step>
            <Step>Enrolment details</Step>
            <Step>Password &amp; security</Step>
            <Step>Profile photo (optional)</Step>
          </ul>
          <Link to="/onboarding/set-password">
            <Button className="mt-6 self-start">Let's go →</Button>
          </Link>
          <p className="mt-3 text-xs text-muted">
            Trouble? Write to{' '}
            <a className="text-brand-navy font-medium" href="mailto:support@indialearns.com">
              support@indialearns.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

function LandingPoint({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <li className="flex gap-3 items-start">
      <span className="font-mono w-9 h-9 rounded-lg bg-brand-orange/20 text-brand-orange grid place-items-center text-xs font-bold">
        {n}
      </span>
      <div>
        <p className="font-semibold text-sm">{t}</p>
        <p className="text-xs text-white/70 mt-0.5">{d}</p>
      </div>
    </li>
  );
}

function Step({ children, done }: { children: React.ReactNode; done?: boolean }) {
  return (
    <li className={`flex items-center gap-3 ${done ? 'text-success' : 'text-muted'}`}>
      <span
        className={`h-5 w-5 rounded-full grid place-items-center text-xs ${done ? 'bg-success/15 text-success' : 'bg-brand-cream text-muted'}`}
        aria-hidden
      >
        {done ? '✓' : '·'}
      </span>
      <span className={done ? 'line-through opacity-70' : ''}>{children}</span>
    </li>
  );
}

export function OnbSetPasswordPage() {
  // Real account creation lives in /accept-invite (token-driven). This screen
  // is the marketing-style preview that explains what happens; clicking
  // Continue redirects users without an invite token to the login page.
  return (
    <main className="min-h-screen bg-brand-cream grid place-items-center p-6">
      <Card className="max-w-md w-full p-8">
        <BrandHeader />
        <p className="text-xs uppercase tracking-widest text-brand-orange font-semibold">Step 02 of 03</p>
        <h1 className="text-display-sm text-brand-navy tracking-tight mt-2">Choose a strong password.</h1>
        <p className="text-muted text-sm mt-2">You'll use this to sign in from now on.</p>
        <p className="text-xs text-muted mt-6">
          When your invite email arrives, click "Activate" — you'll land on the secure password screen.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/accept-invite">
            <Button className="w-full">I have an invite token</Button>
          </Link>
          <Link to="/login" className="text-sm text-brand-navy underline-offset-4 hover:underline text-center">
            Already have an account? Log in
          </Link>
        </div>
      </Card>
    </main>
  );
}

const TOUR_SLIDES = [
  {
    title: 'Your dashboard',
    body: 'Everything — today\'s classes, pending work, unread notes — opens from a single screen.',
    accent: '#F58220',
  },
  {
    title: 'Learn at your pace',
    body: 'Video lessons, PDFs and quizzes are organised by module. Resume right where you stopped, on web or phone.',
    accent: '#6E9BCC',
  },
  {
    title: 'Talk to your faculty',
    body: 'Questions on a lecture? Open a ticket. Want to give feedback? We read every response.',
    accent: '#F58220',
  },
];

export function OnbTourPage() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const s = TOUR_SLIDES[slide]!;
  function done() {
    navigate('/onboarding/arrival');
  }
  return (
    <main className="min-h-screen bg-brand-cream grid place-items-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-elev-4 overflow-hidden animate-fade-in-up">
        <div
          className="aspect-[2.2/1] grid place-items-center relative"
          style={{
            background:
              'repeating-linear-gradient(135deg, #F2EADA 0 20px, #FBF5E8 20px 40px)',
          }}
        >
          <div className="text-center">
            <div
              className="h-28 w-28 rounded-3xl mx-auto grid place-items-center text-brand-navy font-extrabold text-5xl shadow-lg"
              style={{ background: s.accent }}
            >
              IL
            </div>
            <p className="font-mono text-xs tracking-widest text-muted mt-3">
              TOUR · {String(slide + 1).padStart(2, '0')} OF 03
            </p>
          </div>
        </div>
        <div className="p-8 text-center">
          <h2 className="text-display-sm text-brand-navy tracking-tight">{s.title}</h2>
          <p className="text-muted text-sm mt-2 max-w-md mx-auto">{s.body}</p>
          <div className="flex gap-2 justify-center mt-6">
            {TOUR_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === slide ? 'w-7 bg-brand-orange' : 'w-2 bg-brand-cream'}`}
              />
            ))}
          </div>
          <div className="flex gap-3 justify-center mt-6">
            <Button variant="ghost" onClick={done}>
              Skip tour
            </Button>
            {slide < TOUR_SLIDES.length - 1 ? (
              <Button onClick={() => setSlide(slide + 1)}>Next →</Button>
            ) : (
              <Button onClick={done}>Enter dashboard →</Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export function OnbArrivalPage() {
  return (
    <main className="min-h-screen bg-brand-navy grid place-items-center p-6 text-white text-center">
      <div className="max-w-md">
        <div className="h-24 w-24 rounded-full bg-brand-orange text-brand-navy grid place-items-center text-5xl font-bold mx-auto shadow-2xl">
          ✓
        </div>
        <h1 className="text-display-md mt-7 leading-tight tracking-tight">
          You're all set.
        </h1>
        <p className="text-white/70 mt-3">
          Your first class will appear on your dashboard. We'll remind you 30
          minutes before, by email.
        </p>
        <Link to="/student/dashboard">
          <Button className="mt-6">Go to my dashboard →</Button>
        </Link>
      </div>
    </main>
  );
}
