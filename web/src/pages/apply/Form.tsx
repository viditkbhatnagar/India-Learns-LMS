import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplicationDraftStep2Personal,
  ApplicationDraftStep3Contact,
  ApplicationDraftStep4Program,
  ApplicationDraftStep5Academic,
  ApplicationDraftStep5AcademicEntry,
  ApplicationDraftStepName,
  PublicCohortDto,
  PublicProgramDto,
} from 'india-learns-shared-types';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { admissionsApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

// M2 — Multi-step application form (Steps 2–5). Mounted at /apply/form.
//
// The form is driven by a single draft document on the server; the client
// keeps a working in-memory copy synced with the server on Next/Back + a
// 30-second heartbeat. The form uses simple controlled inputs everywhere —
// good enough for V1; if validation needs grow we'll swap in react-hook-form
// in M10 polish.

const STEPS: { id: ApplicationDraftStepName; label: string; number: number }[] = [
  { id: 'step2_personal', label: 'Personal', number: 2 },
  { id: 'step3_contact', label: 'Contact', number: 3 },
  { id: 'step4_program', label: 'Program', number: 4 },
  { id: 'step5_academic', label: 'Academic', number: 5 },
  { id: 'step6_documents', label: 'Documents', number: 6 },
  { id: 'step7_statement', label: 'Statement', number: 7 },
  { id: 'step8_references', label: 'References', number: 8 },
  { id: 'step9_consents', label: 'Submit', number: 9 },
];

// Local working shapes — every field is optional during data entry; the
// service-side submit step strictly validates required fields.
type Step3State = {
  mobilePhoneE164?: string;
  altPhoneE164?: string | null;
  address: Partial<ApplicationDraftStep3Contact['address']>;
  emergency: Partial<ApplicationDraftStep3Contact['emergency']>;
};

interface DraftState {
  step2: Partial<ApplicationDraftStep2Personal>;
  step3: Step3State;
  step4: Partial<ApplicationDraftStep4Program>;
  step5: ApplicationDraftStep5Academic;
}

function emptyDraft(): DraftState {
  return {
    step2: {},
    step3: { address: {}, emergency: {} },
    step4: {},
    step5: [],
  };
}

function isAdult(dob: string): boolean {
  if (!dob) return false;
  const dobDate = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(dobDate.getTime())) return false;
  const now = new Date();
  const age = now.getUTCFullYear() - dobDate.getUTCFullYear() - (
    now.getUTCMonth() < dobDate.getUTCMonth()
      || (now.getUTCMonth() === dobDate.getUTCMonth() && now.getUTCDate() < dobDate.getUTCDate())
      ? 1
      : 0
  );
  return age >= 18;
}

const STEP_TITLE: Record<ApplicationDraftStepName, string> = {
  step2_personal: 'Personal information',
  step3_contact: 'Contact information',
  step4_program: 'Program selection',
  step5_academic: 'Academic background',
  step6_documents: 'Supporting documents',
  step7_statement: 'Personal statement',
  step8_references: 'References',
  step9_consents: 'Review and submit',
};

const STEP_HELP: Record<ApplicationDraftStepName, string> = {
  step2_personal: 'Your legal name as it appears on government ID, and a few demographic details.',
  step3_contact: 'Where we can reach you and an emergency contact.',
  step4_program: 'Which program (and cohort, where applicable) you\'re applying for.',
  step5_academic: 'Schools and credentials. Add as many entries as you need.',
  step6_documents: 'Upload your supporting documents — government ID, transcripts, etc.',
  step7_statement: 'Tell us about yourself in your own words.',
  step8_references: 'Add referee details. We\'ll email them a secure upload link.',
  step9_consents: 'Confirm consents and submit your application.',
};

const TARGET_BY_STEP: Record<ApplicationDraftStepName, string> = {
  step2_personal: '/apply/form',
  step3_contact: '/apply/form',
  step4_program: '/apply/form',
  step5_academic: '/apply/form',
  step6_documents: '/apply/documents',
  step7_statement: '/apply/statement',
  step8_references: '/apply/references',
  step9_consents: '/apply/submit',
};

export function ApplyFormPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [completedSteps, setCompletedSteps] = useState<Set<ApplicationDraftStepName>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const lastSavedAtRef = useRef<number>(Date.now());

  const { data: serverDraft, isLoading: draftLoading } = useQuery({
    queryKey: ['admissions', 'me', 'draft'],
    queryFn: () => admissionsApi.getDraft(),
  });

  const { data: programs } = useQuery({
    queryKey: ['admissions', 'apply', 'programs'],
    queryFn: () => admissionsApi.listPublicPrograms(),
  });

  // Hydrate local state from the server draft on first load.
  const hydratedOnceRef = useRef(false);
  useEffect(() => {
    if (!serverDraft || hydratedOnceRef.current) return;
    const data = serverDraft.data ?? {};
    const incomingStep3 = data.step3_contact as
      | Partial<{
          mobilePhoneE164: string;
          altPhoneE164: string | null;
          address: Partial<ApplicationDraftStep3Contact['address']>;
          emergency: Partial<ApplicationDraftStep3Contact['emergency']>;
        }>
      | undefined;
    setDraft({
      step2: (data.step2_personal as DraftState['step2']) ?? {},
      step3: {
        mobilePhoneE164: incomingStep3?.mobilePhoneE164,
        altPhoneE164: incomingStep3?.altPhoneE164 ?? null,
        address: incomingStep3?.address ?? {},
        emergency: incomingStep3?.emergency ?? {},
      },
      step4: (data.step4_program as DraftState['step4']) ?? {},
      step5: ((data.step5_academic as DraftState['step5']) ?? []) as ApplicationDraftStep5Academic,
    });
    setCompletedSteps(new Set(serverDraft.completedSteps));
    hydratedOnceRef.current = true;
  }, [serverDraft]);

  const saveMutation = useMutation({
    mutationFn: (input: {
      step: ApplicationDraftStepName;
      payload: unknown;
      markComplete?: boolean;
    }) => admissionsApi.saveDraft(input),
    onSuccess: (data) => {
      lastSavedAtRef.current = Date.now();
      setCompletedSteps(new Set(data.completedSteps));
      queryClient.setQueryData(['admissions', 'me', 'draft'], data);
    },
    onError: (err) => {
      if (err instanceof ApiHttpError) {
        setError(err.message);
      } else {
        setError('Could not save draft. Your changes are local only until saved.');
      }
    },
  });

  // Heartbeat — every 30s, save the current step to the server if it's been
  // modified since the last save. We always save the *current* step's
  // payload, marked incomplete (the explicit Next button is what bumps
  // markComplete=true).
  useEffect(() => {
    const id = window.setInterval(() => {
      const currentStep = STEPS[stepIndex];
      if (!currentStep) return;
      const payload = payloadForStep(currentStep.id, draft);
      if (payload === null) return;
      saveMutation.mutate({ step: currentStep.id, payload, markComplete: false });
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, draft]);

  const currentStep = STEPS[stepIndex];

  async function goNext() {
    setError(null);
    if (!currentStep) return;
    const validation = validateStep(currentStep.id, draft, programs ?? []);
    if (validation) {
      setError(validation);
      return;
    }
    const payload = payloadForStep(currentStep.id, draft);
    if (payload !== null) {
      await saveMutation.mutateAsync({
        step: currentStep.id,
        payload,
        markComplete: true,
      });
    }
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      navigate('/apply/portal');
    }
  }

  async function goBack() {
    if (stepIndex > 0) {
      // Save current step (incomplete) before navigating back.
      setError(null);
      const cur = STEPS[stepIndex];
      if (cur) {
        const payload = payloadForStep(cur.id, draft);
        if (payload !== null) {
          await saveMutation.mutateAsync({
            step: cur.id,
            payload,
            markComplete: completedSteps.has(cur.id),
          });
        }
      }
      setStepIndex(stepIndex - 1);
    }
  }

  if (draftLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-surface">
        <p className="text-muted">Loading your application…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/apply" className="flex items-center gap-3">
            <img src="/brand/logo.jpg" alt="India Learns" className="h-9 w-auto rounded-md" />
            <span className="text-brand-navy font-semibold">India Learns</span>
          </Link>
          <Link
            to="/apply/portal"
            className="text-sm font-medium text-brand-navy hover:text-brand-orange"
          >
            Save and exit
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <ProgressBar
          steps={STEPS}
          stepIndex={stepIndex}
          completedSteps={completedSteps}
          onJump={(idx) => setStepIndex(idx)}
        />
        <article className="rounded-2xl bg-white shadow-elev-1 border border-black/5 p-6 sm:p-8">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-1">
              Step {currentStep?.number ?? ''} of 11
            </p>
            <h1 className="text-display-sm text-brand-navy">
              {STEP_TITLE[currentStep?.id ?? 'step2_personal']}
            </h1>
            <p className="mt-2 text-muted text-sm">
              {STEP_HELP[currentStep?.id ?? 'step2_personal']}
            </p>
          </header>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              goNext();
            }}
            noValidate
            className="space-y-6"
          >
            {currentStep?.id === 'step2_personal' && (
              <Step2Personal draft={draft} setDraft={setDraft} />
            )}
            {currentStep?.id === 'step3_contact' && (
              <Step3Contact draft={draft} setDraft={setDraft} />
            )}
            {currentStep?.id === 'step4_program' && (
              <Step4Program draft={draft} setDraft={setDraft} programs={programs ?? []} />
            )}
            {currentStep?.id === 'step5_academic' && (
              <Step5Academic draft={draft} setDraft={setDraft} />
            )}
            {currentStep && currentStep.number > 5 && (
              <Step6PlusPlaceholder stepId={currentStep.id} />
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm"
              >
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-black/5">
              <Button type="button" variant="ghost" onClick={goBack} disabled={stepIndex === 0}>
                ← Back
              </Button>
              <div className="text-xs text-muted">
                {saveMutation.isPending ? 'Saving…' : 'All changes saved'}
              </div>
              <Button type="submit" loading={saveMutation.isPending}>
                {stepIndex === STEPS.length - 1 ? 'Finish later' : 'Next →'}
              </Button>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}

function ProgressBar({
  steps,
  stepIndex,
  completedSteps,
  onJump,
}: {
  steps: { id: ApplicationDraftStepName; label: string; number: number }[];
  stepIndex: number;
  completedSteps: Set<ApplicationDraftStepName>;
  onJump: (idx: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="Application steps">
      {steps.map((s, i) => {
        const isCurrent = i === stepIndex;
        const isCompleted = completedSteps.has(s.id);
        const canJump = isCompleted || i <= stepIndex;
        return (
          <li key={s.id} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onJump(i)}
              className={
                `flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                 isCurrent
                  ? 'bg-brand-navy text-white'
                  : isCompleted
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-surface-muted text-muted'}`
              }
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="inline-block min-w-[1ch] text-center">{s.number}</span>
              <span className="hidden sm:inline">{s.label}</span>
              {isCompleted && !isCurrent && (
                <span aria-hidden className="text-emerald-600">✓</span>
              )}
            </button>
            {i < steps.length - 1 && <span aria-hidden className="text-muted">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Step2Personal({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const s = draft.step2;
  const update = (patch: Partial<ApplicationDraftStep2Personal>) =>
    setDraft({ ...draft, step2: { ...s, ...patch } });
  const dobInvalid = Boolean(s.dateOfBirthIst) && !isAdult(s.dateOfBirthIst ?? '');
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Input
        label="Legal first name"
        value={s.legalFirstName ?? ''}
        onChange={(e) => update({ legalFirstName: e.target.value })}
        required
        autoComplete="given-name"
      />
      <Input
        label="Middle name"
        value={s.middleName ?? ''}
        onChange={(e) => update({ middleName: e.target.value })}
        autoComplete="additional-name"
      />
      <Input
        label="Legal last name"
        value={s.legalLastName ?? ''}
        onChange={(e) => update({ legalLastName: e.target.value })}
        required
        autoComplete="family-name"
      />
      <Input
        label="Preferred name"
        value={s.preferredName ?? ''}
        onChange={(e) => update({ preferredName: e.target.value })}
        autoComplete="nickname"
      />
      <Input
        type="date"
        label="Date of birth"
        value={s.dateOfBirthIst ?? ''}
        onChange={(e) => update({ dateOfBirthIst: e.target.value })}
        required
        error={dobInvalid ? 'You must be 18 or older to apply.' : undefined}
        hint={dobInvalid ? undefined : 'Drives FERPA age-related logic.'}
      />
      <SelectField
        label="Gender identity (optional)"
        value={s.genderIdentity ?? ''}
        onChange={(v) => update({ genderIdentity: v || null })}
        options={[
          { value: '', label: 'Prefer not to say' },
          { value: 'female', label: 'Female' },
          { value: 'male', label: 'Male' },
          { value: 'non_binary', label: 'Non-binary' },
          { value: 'other', label: 'Other' },
        ]}
      />
      <Input
        label="Citizenship / nationality"
        value={s.citizenship ?? ''}
        onChange={(e) => update({ citizenship: e.target.value })}
        required
        placeholder="Indian"
      />
      <Input
        label="Country of birth (optional)"
        value={s.countryOfBirth ?? ''}
        onChange={(e) => update({ countryOfBirth: e.target.value || null })}
      />
      <Input
        label="Primary language (optional)"
        value={s.primaryLanguage ?? ''}
        onChange={(e) => update({ primaryLanguage: e.target.value || null })}
        placeholder="English"
      />
    </div>
  );
}

function Step3Contact({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const s = draft.step3;
  const addr = s.address ?? {};
  const em = s.emergency ?? {};
  const updateAddr = (patch: Partial<ApplicationDraftStep3Contact['address']>) =>
    setDraft({ ...draft, step3: { ...s, address: { ...addr, ...patch } } });
  const updateEm = (patch: Partial<ApplicationDraftStep3Contact['emergency']>) =>
    setDraft({ ...draft, step3: { ...s, emergency: { ...em, ...patch } } });
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Input
            label="Mailing address (street)"
            value={addr.street ?? ''}
            onChange={(e) => updateAddr({ street: e.target.value })}
            required
            autoComplete="street-address"
          />
        </div>
        <Input
          label="City"
          value={addr.city ?? ''}
          onChange={(e) => updateAddr({ city: e.target.value })}
          required
          autoComplete="address-level2"
        />
        <Input
          label="State / Province"
          value={addr.stateProvince ?? ''}
          onChange={(e) => updateAddr({ stateProvince: e.target.value })}
          required
          autoComplete="address-level1"
        />
        <Input
          label="Postal code"
          value={addr.postalCode ?? ''}
          onChange={(e) => updateAddr({ postalCode: e.target.value })}
          required
          autoComplete="postal-code"
        />
        <Input
          label="Country"
          value={addr.country ?? ''}
          onChange={(e) => updateAddr({ country: e.target.value })}
          required
          autoComplete="country-name"
          placeholder="India"
        />
        <Input
          type="tel"
          label="Mobile phone (with country code)"
          value={s.mobilePhoneE164 ?? ''}
          onChange={(e) => setDraft({ ...draft, step3: { ...s, mobilePhoneE164: e.target.value } })}
          required
          pattern="^\+\d{6,15}$"
          autoComplete="tel"
          placeholder="+919876543210"
        />
        <Input
          type="tel"
          label="Alternate phone (optional)"
          value={s.altPhoneE164 ?? ''}
          onChange={(e) => setDraft({ ...draft, step3: { ...s, altPhoneE164: e.target.value || null } })}
          pattern="^\+\d{6,15}$"
        />
      </div>
      <fieldset className="rounded-xl border border-black/10 p-4">
        <legend className="px-2 text-sm font-semibold text-brand-navy">Emergency contact</legend>
        <div className="grid sm:grid-cols-3 gap-4">
          <Input
            label="Name"
            value={em.name ?? ''}
            onChange={(e) => updateEm({ name: e.target.value })}
            required
          />
          <Input
            label="Relationship"
            value={em.relationship ?? ''}
            onChange={(e) => updateEm({ relationship: e.target.value })}
            required
            placeholder="Parent / Sibling / Spouse"
          />
          <Input
            type="tel"
            label="Phone"
            value={em.phoneE164 ?? ''}
            onChange={(e) => updateEm({ phoneE164: e.target.value })}
            required
            pattern="^\+\d{6,15}$"
            placeholder="+919876543210"
          />
        </div>
      </fieldset>
    </div>
  );
}

function Step4Program({
  draft,
  setDraft,
  programs,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
  programs: PublicProgramDto[];
}) {
  const s = draft.step4;
  const selectedProgram = programs.find((p) => p.id === s.programId);
  const update = (patch: Partial<ApplicationDraftStep4Program>) =>
    setDraft({ ...draft, step4: { ...s, ...patch } });

  const { data: cohorts } = useQuery({
    queryKey: ['admissions', 'apply', 'cohorts', s.programId],
    queryFn: () => (s.programId ? admissionsApi.listPublicCohorts(s.programId) : Promise.resolve<PublicCohortDto[]>([])),
    enabled: Boolean(s.programId && selectedProgram?.admissionMode === 'cohort_pick'),
  });

  return (
    <div className="space-y-5">
      <SelectField
        label="Program of interest"
        value={s.programId ?? ''}
        onChange={(v) => update({ programId: v, batchId: null })}
        required
        options={[
          { value: '', label: 'Select a program' },
          ...programs.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      {selectedProgram?.admissionMode === 'cohort_pick' && (
        <div>
          <SelectField
            label="Cohort"
            value={s.batchId ?? ''}
            onChange={(v) => update({ batchId: v || null })}
            required
            options={[
              { value: '', label: 'Select a cohort' },
              ...(cohorts ?? []).map((c) => ({
                value: c.id,
                label: `${c.name} — starts ${new Date(c.startDate).toLocaleDateString()} (${c.seatsRemaining} seats left)`,
              })),
            ]}
          />
          {cohorts && cohorts.length === 0 && (
            <p className="mt-1 text-sm text-warning">
              No open cohorts yet. You can save your progress and come back later, or pick a different program.
            </p>
          )}
        </div>
      )}
      {selectedProgram?.admissionMode === 'program_only' && (
        <div className="rounded-xl border border-navy-100 bg-navy-50 p-3 text-sm text-brand-navy">
          The Admissions team will assign your cohort after a decision is made.
          You don't need to pick one here.
        </div>
      )}
      <SelectField
        label="Mode of study (optional)"
        value={s.modeOfStudy ?? ''}
        onChange={(v) => update({ modeOfStudy: (v as ApplicationDraftStep4Program['modeOfStudy']) || null })}
        options={[
          { value: '', label: '—' },
          { value: 'on_campus', label: 'On-campus' },
          { value: 'online', label: 'Online' },
          { value: 'hybrid', label: 'Hybrid' },
        ]}
      />
      <SelectField
        label="Full-time / Part-time (optional)"
        value={s.fullPartTime ?? ''}
        onChange={(v) => update({ fullPartTime: (v as ApplicationDraftStep4Program['fullPartTime']) || null })}
        options={[
          { value: '', label: '—' },
          { value: 'full_time', label: 'Full-time' },
          { value: 'part_time', label: 'Part-time' },
        ]}
      />
      <Input
        label="Intended start (optional)"
        value={s.intendedStartTerm ?? ''}
        onChange={(e) => update({ intendedStartTerm: e.target.value || null })}
        placeholder="e.g. July 2026"
      />
    </div>
  );
}

function Step5Academic({
  draft,
  setDraft,
}: {
  draft: DraftState;
  setDraft: (next: DraftState) => void;
}) {
  const entries = draft.step5;
  const setEntries = (next: ApplicationDraftStep5Academic) =>
    setDraft({ ...draft, step5: next });

  const updateEntry = (idx: number, patch: Partial<ApplicationDraftStep5AcademicEntry>) => {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const removeEntry = (idx: number) => setEntries(entries.filter((_, i) => i !== idx));
  const addEntry = () =>
    setEntries([
      ...entries,
      {
        institutionName: '',
        country: '',
        fromDate: '',
        toDate: null,
        credentialEarned: null,
        gpaOrEquivalent: null,
        standardizedTestScores: null,
      },
    ]);

  return (
    <div className="space-y-5">
      {entries.length === 0 && (
        <p className="text-sm text-muted">No institutions added yet. Click "Add institution" to get started.</p>
      )}
      {entries.map((entry, idx) => (
        // entries don't have IDs; index is stable for the row's lifetime in
        // this UI (the only mutation is append + delete-at-index).
         
        <fieldset key={idx} className="rounded-xl border border-black/10 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold text-brand-navy">Institution {idx + 1}</legend>
            <button
              type="button"
              onClick={() => removeEntry(idx)}
              className="text-sm text-danger hover:underline"
            >
              Remove
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Institution name"
              value={entry.institutionName}
              onChange={(e) => updateEntry(idx, { institutionName: e.target.value })}
              required
            />
            <Input
              label="Country"
              value={entry.country}
              onChange={(e) => updateEntry(idx, { country: e.target.value })}
              required
            />
            <Input
              type="date"
              label="From"
              value={entry.fromDate}
              onChange={(e) => updateEntry(idx, { fromDate: e.target.value })}
              required
            />
            <Input
              type="date"
              label="To (or expected)"
              value={entry.toDate ?? ''}
              onChange={(e) => updateEntry(idx, { toDate: e.target.value || null })}
            />
            <Input
              label="Credential / degree earned"
              value={entry.credentialEarned ?? ''}
              onChange={(e) => updateEntry(idx, { credentialEarned: e.target.value || null })}
            />
            <Input
              label="GPA / equivalent"
              value={entry.gpaOrEquivalent ?? ''}
              onChange={(e) => updateEntry(idx, { gpaOrEquivalent: e.target.value || null })}
              hint="Free text — include the scale, e.g. 3.4/4.0 or 78%"
            />
            <div className="sm:col-span-2">
              <Input
                label="Standardized test scores (optional)"
                value={entry.standardizedTestScores ?? ''}
                onChange={(e) => updateEntry(idx, { standardizedTestScores: e.target.value || null })}
                hint="Free text — e.g. SAT 1400, IELTS 7.5"
              />
            </div>
          </div>
        </fieldset>
      ))}
      <Button type="button" variant="secondary" onClick={addEntry}>
        + Add institution
      </Button>
    </div>
  );
}

function Step6PlusPlaceholder({ stepId }: { stepId: ApplicationDraftStepName }) {
  // M2 ships Steps 2–5 in this file. Steps 6–9 are handled on separate
  // pages so they can carry deeper UI (file uploads, referee invites,
  // consent checkboxes, submit summary). The shell shows a friendly nudge
  // when the applicant clicks Next on Step 5.
  const target = TARGET_BY_STEP[stepId];
  return (
    <div className="rounded-xl border border-navy-100 bg-navy-50 p-4 text-sm text-brand-navy">
      <p className="font-semibold mb-1">Continue on the next page</p>
      <p>
        Open <Link to={target} className="underline">{target}</Link> to complete this step.
        Your progress so far is saved.
      </p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const id = useMemo(() => `sel-${Math.random().toString(36).slice(2)}`, []);
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-semibold text-brand-navy mb-1.5 tracking-tight">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full h-11 px-3.5 rounded-xl border border-black/10 bg-white text-ink focus:outline-none focus:ring-4 focus:ring-brand-navy/15 focus:border-brand-orange"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function payloadForStep(
  step: ApplicationDraftStepName,
  draft: DraftState,
): unknown {
  switch (step) {
    case 'step2_personal':
      return draft.step2;
    case 'step3_contact':
      return draft.step3;
    case 'step4_program':
      return draft.step4;
    case 'step5_academic':
      return draft.step5;
    default:
      return null;
  }
}

function validateStep(
  step: ApplicationDraftStepName,
  draft: DraftState,
  _programs: PublicProgramDto[],
): string | null {
  if (step === 'step2_personal') {
    const s = draft.step2;
    if (!s.legalFirstName || !s.legalLastName) return 'Legal first and last name are required.';
    if (!s.dateOfBirthIst) return 'Date of birth is required.';
    if (!isAdult(s.dateOfBirthIst)) return 'Applicants must be 18 or older.';
    if (!s.citizenship) return 'Citizenship is required.';
    return null;
  }
  if (step === 'step3_contact') {
    const a = draft.step3.address ?? {};
    const em = draft.step3.emergency ?? {};
    if (!a.street || !a.city || !a.stateProvince || !a.postalCode || !a.country) {
      return 'Complete the full address.';
    }
    if (!draft.step3.mobilePhoneE164) return 'Mobile phone is required.';
    if (!em.name || !em.relationship || !em.phoneE164) return 'Emergency contact is required.';
    return null;
  }
  if (step === 'step4_program') {
    if (!draft.step4.programId) return 'Choose a program.';
    return null;
  }
  if (step === 'step5_academic') {
    if (draft.step5.length === 0) return 'Add at least one prior institution.';
    for (const [i, e] of draft.step5.entries()) {
      if (!e.institutionName || !e.country || !e.fromDate) {
        return `Institution ${i + 1}: name, country, and start date are required.`;
      }
    }
    return null;
  }
  return null;
}

