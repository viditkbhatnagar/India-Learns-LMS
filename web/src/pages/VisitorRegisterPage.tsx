import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  VISITOR_LEAD_SOURCES,
  VISITOR_QUALIFICATIONS,
  type VisitorLeadSource,
  type VisitorQualification,
} from 'india-learns-shared-types';
import { api, ApiHttpError } from '../lib/api.js';
import { normalizePhoneLoose, PHONE_HINT } from '../lib/phone.js';
import { AuthLayout, AuthCard } from '../components/AuthHero.js';
import { Button } from '../components/ui/Button.js';
import { Input, TextArea } from '../components/ui/Input.js';

// M10u — Public visitor self-registration form. Same fields as the admin
// capture form but submitted without auth. Backend rate-limits per IP
// (5/hr) and forces otpVerificationStatus='pending'. Admin reviews the
// new lead at /admin/visitor-leads and follows up.

type FieldErrors = Partial<Record<string, string>>;

const QUALIFICATION_LABEL: Record<VisitorQualification, string> = {
  high_school: 'High School',
  bba: 'BBA',
  btech: 'B.Tech',
  graduate: 'Graduate',
  other: 'Other',
};

const SOURCE_LABEL: Record<VisitorLeadSource, string> = {
  reference: 'Reference',
  google: 'Google',
  social_media: 'Social Media',
  walk_in: 'Walk-in',
  meta: 'Meta (FB / IG ads)',
  agent: 'Agent',
  other: 'Other',
};

export function VisitorRegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [qualification, setQualification] = useState<VisitorQualification | ''>('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pin, setPin] = useState('');
  const [source, setSource] = useState<VisitorLeadSource>('walk_in');
  const [socialId, setSocialId] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api.post('/public/visitor/register', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        // Send normalized E.164 when we can (10-digit → +91…); otherwise send
        // the raw value so the server returns the friendly phone error.
        phoneE164: normalizePhoneLoose(phone) ?? phone.trim(),
        email: email.trim() || null,
        highestQualification: (qualification || null) as VisitorQualification | null,
        dateOfBirth: dob.trim() || null,
        currentAddress:
          city.trim() || state.trim() || pin.trim()
            ? {
                street: '',
                city: city.trim(),
                stateProvince: state.trim(),
                postalCode: pin.trim(),
                country: 'India',
              }
            : null,
        leadSource: source,
        socialMediaId: socialId.trim() || null,
        parentGuardianContact: parentContact.trim() || null,
        notes: notes.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiHttpError) {
        const details = err.details as
          | { fieldErrors?: Record<string, string[]> }
          | undefined;
        const fe = details?.fieldErrors;
        if (fe && Object.keys(fe).length > 0) {
          const next: FieldErrors = {};
          for (const [k, v] of Object.entries(fe)) {
            next[k] = v?.[0];
          }
          setFieldErrors(next);
          setFormError('Please fix the highlighted fields below.');
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Could not submit. Please try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <AuthLayout
        title="Thanks — we've got your details"
        subtitle="An India Learns counsellor will get in touch with you shortly."
      >
        <AuthCard>
          <p className="text-ink mb-3">
            Your lead has been received. We typically reach out within one
            business day.
          </p>
          <p className="text-sm text-muted mb-5">
            If you don't hear from us within 24 hours, please raise it through
            the contact us page or call our office.
          </p>
          <Link
            to="/login"
            className="inline-block text-brand-navy hover:text-brand-orange font-medium transition-colors"
          >
            Already have an account? Sign in →
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Register your interest"
      subtitle="Tell us about yourself and an India Learns counsellor will reach out."
    >
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              error={fieldErrors.firstName}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              error={fieldErrors.lastName}
            />
            <Input
              type="tel"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              hint={PHONE_HINT}
              error={fieldErrors.phoneE164}
            />
            <Input
              type="email"
              label="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs uppercase tracking-wider text-muted font-bold">
                Highest qualification
              </span>
              <select
                value={qualification}
                onChange={(e) => setQualification(e.target.value as VisitorQualification | '')}
                className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
              >
                <option value="">— Select —</option>
                {VISITOR_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {QUALIFICATION_LABEL[q]}
                  </option>
                ))}
              </select>
            </label>
            <Input
              type="date"
              label="Date of birth (optional)"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              error={fieldErrors.dateOfBirth}
            />
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
            <Input
              label="Pin code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs uppercase tracking-wider text-muted font-bold">
                How did you hear about us?
              </span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as VisitorLeadSource)}
                className="rounded-xl border border-black/10 px-3 py-2.5 bg-white"
              >
                {VISITOR_LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Social handle / link (optional)"
              value={socialId}
              onChange={(e) => setSocialId(e.target.value)}
              placeholder="@handle or full URL"
            />
            <Input
              label="Parent / guardian contact (optional)"
              value={parentContact}
              onChange={(e) => setParentContact(e.target.value)}
              placeholder="Name + phone"
            />
          </div>
          <TextArea
            label="Anything we should know? (optional)"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Which programme caught your eye, when you'd like to start, etc."
          />
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm animate-fade-in"
            >
              {formError}
            </div>
          )}
          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Submit
          </Button>
          <p className="text-xs text-muted text-center">
            By submitting this form you agree to be contacted by an India
            Learns counsellor.
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
