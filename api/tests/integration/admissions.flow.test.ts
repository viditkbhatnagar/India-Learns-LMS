import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { makeBatch, makeProgram, makeUser } from '../helpers/factories.js';
import { http } from '../helpers/http.js';
import {
  AdmissionsAuditLog,
  Application,
  ApplicationDocument,
  Batch,
  Program,
  Referee,
  ReviewerNote,
} from '../../src/models/index.js';
import { verifyAuditChain } from '../../src/services/admissions/admissionsAuditService.js';

describe('admissions M2-M5 — end-to-end flow', () => {
  useMongo();
  const spies = useIntegrationSpies();

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await http()
      .post('/v1/auth/login')
      .send({ email, password, deviceId: 'dev-test' });
    expect(res.status).toBe(200);
    return res.body.data.accessToken as string;
  }

  async function adminToken(): Promise<{ token: string; userId: string }> {
    const admin = await makeUser({
      role: 'admin',
      password: 'Admin#12345',
      status: 'active',
    });
    const token = await loginAs(admin.email, 'Admin#12345');
    return { token, userId: String(admin._id) };
  }

  let phoneSeq = 0;
  async function signupApplicant(suffix = ''): Promise<{ token: string; appId: string }> {
    phoneSeq += 1;
    const phone = `+9198${String(phoneSeq).padStart(8, '0')}`;
    const res = await http()
      .post('/v1/admissions/apply/signup')
      .send({
        email: `applicant-${suffix}-${phoneSeq}@example.com`,
        name: `Applicant ${suffix}`,
        phoneE164: phone,
        password: 'Welcome#12345',
        deviceId: `dev-app-${suffix}`,
      });
    expect(res.status).toBe(201);
    return {
      token: res.body.data.accessToken,
      appId: res.body.data.application.id,
    };
  }

  async function seedAdmissionsProgram(opts: {
    admissionMode?: 'cohort_pick' | 'program_only';
    requiresStatement?: boolean;
    requiresReferences?: boolean;
    referencesMinCount?: number;
    referencesMaxCount?: number;
  } = {}): Promise<{ program: { _id: string }; batch: { _id: string } | null }> {
    const program = await makeProgram({ name: 'Aviation Diploma' });
    await Program.updateOne(
      { _id: program._id },
      {
        $set: {
          admissionsEnabled: true,
          admissionMode: opts.admissionMode ?? 'cohort_pick',
          applicationFeePaise: 0,
          requiresStatement: opts.requiresStatement ?? false,
          requiresReferences: opts.requiresReferences ?? false,
          referencesMinCount: opts.referencesMinCount ?? 1,
          referencesMaxCount: opts.referencesMaxCount ?? 2,
        },
      },
    );
    let batchRow: { _id: string } | null = null;
    if ((opts.admissionMode ?? 'cohort_pick') === 'cohort_pick') {
      const batch = await makeBatch({ programId: program._id, capacity: 5 });
      await Batch.updateOne(
        { _id: batch._id },
        { $set: { openForApplications: true, seatsRemaining: 5 } },
      );
      batchRow = { _id: String(batch._id) };
    }
    return { program: { _id: String(program._id) }, batch: batchRow };
  }

  it('M2 — public programs feed returns only admissions-enabled programs', async () => {
    await seedAdmissionsProgram({});
    await makeProgram({ name: 'Other (no admissions)' });
    const res = await http().get('/v1/admissions/apply/programs');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Aviation Diploma');
  });

  it('M2 — cohort listing returns open cohorts with seats remaining', async () => {
    const { program } = await seedAdmissionsProgram({});
    const res = await http().get(`/v1/admissions/apply/programs/${program._id}/cohorts`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].seatsRemaining).toBe(5);
  });

  it('M2 — applicant saves and resumes draft', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m2');

    const save1 = await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step2_personal',
        payload: {
          legalFirstName: 'Asha',
          legalLastName: 'R',
          dateOfBirthIst: '2000-01-15',
          citizenship: 'Indian',
        },
        markComplete: true,
      });
    expect(save1.status).toBe(200);
    expect(save1.body.data.draft.completedSteps).toContain('step2_personal');

    const get = await http()
      .get('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect((get.body.data.draft.data.step2_personal as { legalFirstName: string }).legalFirstName).toBe('Asha');
  });

  it('M3a — sign-upload + register document + delete', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m3a');

    const sign = await http()
      .post('/v1/admissions/me/documents/sign-upload')
      .set('authorization', `Bearer ${token}`)
      .send({
        documentType: 'govid',
        mimeType: 'application/pdf',
        sizeBytes: 50_000,
      });
    expect(sign.status).toBe(200);
    // URL shape depends on the storage adapter (stub vs. Cloudinary vs.
    // integration-spy). Just check it's a usable URL.
    expect(sign.body.data.ticket.url).toMatch(/^https?:\/\//);
    expect(sign.body.data.ticket.key).toBeTruthy();

    const register = await http()
      .post('/v1/admissions/me/documents')
      .set('authorization', `Bearer ${token}`)
      .send({
        documentType: 'govid',
        url: sign.body.data.ticket.url,
        key: sign.body.data.ticket.key,
        sizeBytes: 50_000,
        mimeType: 'application/pdf',
      });
    expect(register.status).toBe(201);
    const docId = register.body.data.document.id;

    const list = await http()
      .get('/v1/admissions/me/documents')
      .set('authorization', `Bearer ${token}`);
    expect(list.body.data.items).toHaveLength(1);

    const del = await http()
      .delete(`/v1/admissions/me/documents/${docId}`)
      .set('authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const empty = await http()
      .get('/v1/admissions/me/documents')
      .set('authorization', `Bearer ${token}`);
    expect(empty.body.data.items).toHaveLength(0);
  });

  it('M3a — rejects oversize and non-PDF/JPG/PNG uploads', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m3a-rej');
    const oversize = await http()
      .post('/v1/admissions/me/documents/sign-upload')
      .set('authorization', `Bearer ${token}`)
      .send({ documentType: 'govid', mimeType: 'application/pdf', sizeBytes: 20 * 1024 * 1024 });
    expect(oversize.status).toBe(422);
    const badMime = await http()
      .post('/v1/admissions/me/documents/sign-upload')
      .set('authorization', `Bearer ${token}`)
      .send({ documentType: 'govid', mimeType: 'application/zip', sizeBytes: 1000 });
    expect(badMime.status).toBe(422);
  });

  it('M3a — saves statement under word limit', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m3a-stmt');
    const res = await http()
      .put('/v1/admissions/me/statement')
      .set('authorization', `Bearer ${token}`)
      .send({ statement: 'I love aviation. '.repeat(50) });
    expect(res.status).toBe(200);
    expect((res.body.data.statement as string).length).toBeGreaterThan(0);
  });

  it('M3b — applicant adds referee, public link works, referee uploads', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m3b');

    const added = await http()
      .post('/v1/admissions/me/referees')
      .set('authorization', `Bearer ${token}`)
      .send({
        name: 'Dr Mentor',
        relationship: 'Advisor',
        organization: 'Acme U',
        email: 'mentor@example.com',
      });
    expect(added.status).toBe(201);
    expect(added.body.data.referee.status).toBe('invited');

    // The invite email should have been sent with a token.
    const link = spies.email.calls.find((c) => c.tag === 'referee-invite');
    expect(link).toBeTruthy();
    const refereeUrl = (link?.vars?.refereeUrl as string) ?? '';
    const tokenMatch = refereeUrl.match(/\/refer\/([^/?#]+)$/);
    expect(tokenMatch).toBeTruthy();
    const rawToken = decodeURIComponent(tokenMatch![1]!);

    // Public referee context lookup (no auth header).
    const ctx = await http().get(`/v1/admissions/referee/${rawToken}`);
    expect(ctx.status).toBe(200);
    expect(ctx.body.data.context.refereeName).toBe('Dr Mentor');

    // Sign + upload from the public route.
    const sign = await http()
      .post(`/v1/admissions/referee/${rawToken}/sign-upload`)
      .send({ mimeType: 'application/pdf', sizeBytes: 100_000 });
    expect(sign.status).toBe(200);

    const upload = await http()
      .post(`/v1/admissions/referee/${rawToken}/upload`)
      .send({
        url: sign.body.data.ticket.url,
        key: sign.body.data.ticket.key,
        sizeBytes: 100_000,
        mimeType: 'application/pdf',
      });
    expect(upload.status).toBe(200);

    // Referee status flips to uploaded; reusing the token errors.
    const referee = await Referee.findOne({});
    expect(referee?.status).toBe('uploaded');
    const replay = await http().get(`/v1/admissions/referee/${rawToken}`);
    expect(replay.status).toBe(410);
  });

  it('M3b — public route returns 410 for invalid token', async () => {
    const ctx = await http().get('/v1/admissions/referee/not-a-real-token');
    expect(ctx.status).toBe(410);
  });

  it('M4 — submit blocks until required sections are filled', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m4-block');
    const res = await http()
      .post('/v1/admissions/me/application/submit')
      .set('authorization', `Bearer ${token}`)
      .send({
        truthfulness: true,
        terms: true,
        ferpaNotice: true,
        priorEducationAuth: true,
        communications: true,
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INCOMPLETE_APPLICATION');
  });

  it('M4 — full happy path submit transitions state to submitted', async () => {
    const { program, batch } = await seedAdmissionsProgram({});
    const { token, appId } = await signupApplicant('m4-ok');

    // Fill required draft steps.
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step2_personal',
        payload: {
          legalFirstName: 'Asha',
          legalLastName: 'R',
          dateOfBirthIst: '2000-01-15',
          citizenship: 'Indian',
        },
        markComplete: true,
      });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step3_contact',
        payload: {
          address: {
            street: '1 Test',
            city: 'Mumbai',
            stateProvince: 'MH',
            postalCode: '400001',
            country: 'India',
          },
          mobilePhoneE164: '+919999000099',
          emergency: { name: 'Parent', relationship: 'Mother', phoneE164: '+919999000100' },
        },
        markComplete: true,
      });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step4_program',
        payload: { programId: program._id, batchId: batch?._id },
        markComplete: true,
      });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step5_academic',
        payload: [
          { institutionName: 'School', country: 'India', fromDate: '2018-06-01' },
        ],
        markComplete: true,
      });
    // Upload required documents.
    for (const type of ['govid', 'transcript']) {
      const sign = await http()
        .post('/v1/admissions/me/documents/sign-upload')
        .set('authorization', `Bearer ${token}`)
        .send({ documentType: type, mimeType: 'application/pdf', sizeBytes: 50_000 });
      await http()
        .post('/v1/admissions/me/documents')
        .set('authorization', `Bearer ${token}`)
        .send({
          documentType: type,
          url: sign.body.data.ticket.url,
          key: sign.body.data.ticket.key,
          sizeBytes: 50_000,
          mimeType: 'application/pdf',
        });
    }

    const submit = await http()
      .post('/v1/admissions/me/application/submit')
      .set('authorization', `Bearer ${token}`)
      .send({
        truthfulness: true,
        terms: true,
        ferpaNotice: true,
        priorEducationAuth: true,
        communications: true,
      });
    expect(submit.status).toBe(200);
    expect(submit.body.data.application.state).toBe('submitted');

    const stored = await Application.findById(appId);
    expect(stored?.submittedAt).toBeTruthy();
    expect(stored?.consents.truthfulness.acknowledged).toBe(true);
  });

  it('M4 — applicant can withdraw before terminal state', async () => {
    await seedAdmissionsProgram({});
    const { token } = await signupApplicant('m4-with');
    const res = await http()
      .post('/v1/admissions/me/application/withdraw')
      .set('authorization', `Bearer ${token}`)
      .send({ reason: 'Changed my mind' });
    expect(res.status).toBe(200);
    expect(res.body.data.application.state).toBe('withdrawn');
  });

  it('M5 — officer reads detail, adds note, makes admit decision; audit chain verifies', async () => {
    const { program, batch } = await seedAdmissionsProgram({});
    const { token, appId } = await signupApplicant('m5');

    // Fill out + submit.
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step2_personal',
        payload: { legalFirstName: 'M', legalLastName: 'Five', dateOfBirthIst: '2000-01-15', citizenship: 'Indian' },
        markComplete: true,
      });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step3_contact',
        payload: {
          address: { street: '1', city: 'Mumbai', stateProvince: 'MH', postalCode: '1', country: 'India' },
          mobilePhoneE164: '+919999000099',
          emergency: { name: 'P', relationship: 'M', phoneE164: '+919999000100' },
        },
        markComplete: true,
      });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({ step: 'step4_program', payload: { programId: program._id, batchId: batch?._id }, markComplete: true });
    await http()
      .put('/v1/admissions/me/draft')
      .set('authorization', `Bearer ${token}`)
      .send({
        step: 'step5_academic',
        payload: [{ institutionName: 'S', country: 'India', fromDate: '2018-06-01' }],
        markComplete: true,
      });
    for (const type of ['govid', 'transcript']) {
      const sign = await http()
        .post('/v1/admissions/me/documents/sign-upload')
        .set('authorization', `Bearer ${token}`)
        .send({ documentType: type, mimeType: 'application/pdf', sizeBytes: 1000 });
      await http()
        .post('/v1/admissions/me/documents')
        .set('authorization', `Bearer ${token}`)
        .send({
          documentType: type,
          url: sign.body.data.ticket.url,
          key: sign.body.data.ticket.key,
          sizeBytes: 1000,
          mimeType: 'application/pdf',
        });
    }
    await http()
      .post('/v1/admissions/me/application/submit')
      .set('authorization', `Bearer ${token}`)
      .send({
        truthfulness: true,
        terms: true,
        ferpaNotice: true,
        priorEducationAuth: true,
        communications: true,
      });

    // Officer view.
    const { token: officerToken } = await adminToken();
    const detail = await http()
      .get(`/v1/admissions/officer/applications/${appId}`)
      .set('authorization', `Bearer ${officerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.application.documents.length).toBe(2);
    expect(detail.body.data.application.consents).toBeTruthy();
    expect(detail.body.data.application.draft).toBeTruthy();

    // Add a note.
    const note = await http()
      .post(`/v1/admissions/officer/applications/${appId}/notes`)
      .set('authorization', `Bearer ${officerToken}`)
      .send({ body: 'Strong applicant — admit.' });
    expect(note.status).toBe(201);
    const allNotes = await ReviewerNote.find({});
    expect(allNotes).toHaveLength(1);

    // Decide admit.
    const decision = await http()
      .post(`/v1/admissions/officer/applications/${appId}/decision`)
      .set('authorization', `Bearer ${officerToken}`)
      .send({ decision: 'admit', reasonApplicant: 'Welcome', reasonInternal: 'Strong fit' });
    expect(decision.status).toBe(200);
    expect(decision.body.data.application.state).toBe('admitted');

    // Audit chain verifies.
    const chain = await http()
      .get(`/v1/admissions/officer/applications/${appId}/audit`)
      .set('authorization', `Bearer ${officerToken}`);
    expect(chain.status).toBe(200);
    expect(chain.body.data.verified).toBe(true);
    expect(chain.body.data.entries.length).toBeGreaterThanOrEqual(3); // viewed + note + decision

    // Tamper detection: flip one row's details and re-verify.
    const stored = await AdmissionsAuditLog.findOne({ action: 'officer.note_added' });
    if (!stored) throw new Error('expected note audit row');
    await AdmissionsAuditLog.updateOne(
      { _id: stored._id },
      { $set: { details: { preview: 'tampered' } } },
    );
    const verify = await verifyAuditChain(stored.applicationId);
    expect(verify.verified).toBe(false);
    expect(verify.brokenAt).toBeTruthy();
  });

  it('M5 — non-officer cannot record a decision', async () => {
    const { program, batch: _batch } = await seedAdmissionsProgram({});
    void program;
    void _batch;
    const { token, appId } = await signupApplicant('m5-noauth');
    const res = await http()
      .post(`/v1/admissions/officer/applications/${appId}/decision`)
      .set('authorization', `Bearer ${token}`)
      .send({ decision: 'admit' });
    expect(res.status).toBe(403);
    const apps = await Application.find({});
    expect(apps).toHaveLength(1);
    // Also confirms no decision was recorded.
    expect(apps[0]!.decision.decision).toBeNull();
    // Confirm referees DTO type compiles.
    expect(Referee).toBeTruthy();
    expect(ApplicationDocument).toBeTruthy();
  });
});
