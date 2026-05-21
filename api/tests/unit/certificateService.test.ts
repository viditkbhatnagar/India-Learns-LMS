import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import {
  makeBatch,
  makeCourse,
  makeEnrollment,
  makeProgram,
  makeStudent,
} from '../helpers/factories.js';
import {
  issueForEnrollment,
  listCertificatesForStudent,
  countIssuedCertificatesForStudent,
  registerCertificateListener,
  resetCertificateListenerRegistration,
} from '../../src/services/certificateService.js';
import { publishDomainEvent, clearListeners } from '../../src/services/domainEventService.js';
import {
  ApiCostLedger,
  AuditLog,
  Enrollment,
  Notification,
} from '../../src/models/index.js';

async function seedCompletedEnrolment() {
  const program = await makeProgram();
  const course = await makeCourse({
    programId: program._id,
    state: 'published',
  });
  const batch = await makeBatch({ programId: program._id });
  const { user: student } = await makeStudent();
  const enrolment = await makeEnrollment({
    studentId: student._id,
    batchId: batch._id,
    courseId: course._id,
    programId: program._id,
  });
  await Enrollment.updateOne(
    { _id: enrolment._id },
    { $set: { completed: true, completedAt: new Date() } },
  );
  return { program, course, batch, student, enrolment };
}

describe('certificateService', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('issueForEnrollment issues, persists URL, records cost, enqueues notification, audits', async () => {
    const { student, enrolment, course } = await seedCompletedEnrolment();

    const result = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'admin',
    });

    expect(result.reissued).toBe(false);
    expect(result.certificate.certificateUrl).toMatch(/^https:\/\/spy\.test\//);
    expect(spies.certificate.calls).toHaveLength(1);

    // Persisted URL + providerId on the enrolment.
    const refreshed = await Enrollment.findById(enrolment._id);
    expect(refreshed?.certificateUrl).toBe(result.certificate.certificateUrl);
    expect(refreshed?.certificateProviderId).toMatch(/^spy-cert-/);
    expect(refreshed?.certificateIssuedAt).not.toBeNull();
    expect(refreshed?.certificateIssueError).toBeNull();

    // Cost ledger incremented.
    const costRows = await ApiCostLedger.find({ provider: 'certifier' });
    expect(costRows).toHaveLength(1);
    expect(costRows[0]!.unitPaise).toBeGreaterThan(0);

    // Notification enqueued for student (email + inapp, no WhatsApp).
    const notifs = await Notification.find({ type: 'certificate.issued' });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.userId.toString()).toBe(student._id.toString());
    expect(notifs[0]!.channels).toEqual(['inapp', 'email']);
    expect(notifs[0]!.title).toContain(course.name);

    // Audit row written.
    const audit = await AuditLog.findOne({
      action: 'certificate.issued',
      targetId: enrolment._id,
    });
    expect(audit).not.toBeNull();
  });

  it('issueForEnrollment is idempotent — second call returns existing URL', async () => {
    const { enrolment } = await seedCompletedEnrolment();

    const first = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'listener',
    });
    expect(first.reissued).toBe(false);
    expect(spies.certificate.calls).toHaveLength(1);

    const second = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'admin',
    });
    expect(second.reissued).toBe(true);
    expect(second.certificate.certificateUrl).toBe(
      first.certificate.certificateUrl,
    );
    // Adapter must NOT be invoked a second time.
    expect(spies.certificate.calls).toHaveLength(1);
    // Audit shows reissue_attempted.
    const reissue = await AuditLog.findOne({
      action: 'certificate.reissue_attempted',
    });
    expect(reissue).not.toBeNull();
  });

  it('issueForEnrollment with force=true reissues, overwrites URL, audits previous values (Q-M8-02)', async () => {
    const { enrolment } = await seedCompletedEnrolment();

    const first = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'admin',
    });
    expect(first.reissued).toBe(false);
    const firstUrl = first.certificate.certificateUrl;
    const firstProviderId = first.certificate.providerId;
    expect(spies.certificate.calls).toHaveLength(1);

    // Listener-driven calls should NOT honor force even if mistakenly passed.
    // Only admin-actor + force flips into the reissue path.
    const listenerWithForce = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'listener',
      force: true,
    });
    expect(listenerWithForce.reissued).toBe(true);
    expect(spies.certificate.calls).toHaveLength(1);

    // Admin force triggers a real adapter call; new URL/providerId overwrite.
    const reissued = await issueForEnrollment({
      enrollmentId: enrolment._id,
      actor: 'admin',
      force: true,
    });
    expect(reissued.reissued).toBe(false);
    expect(spies.certificate.calls).toHaveLength(2);
    expect(reissued.certificate.certificateUrl).not.toBe(firstUrl);

    // Audit row carries the previous URL/providerId for traceability.
    const audits = await AuditLog.find({
      action: 'certificate.issued',
      targetId: enrolment._id,
    }).sort({ createdAt: 1 });
    expect(audits).toHaveLength(2);
    const second = audits[1]!.details as Record<string, unknown>;
    expect(second.forced).toBe(true);
    expect(second.previousCertificateUrl).toBe(firstUrl);
    expect(second.previousProviderId).toBe(firstProviderId);
  });

  it('issueForEnrollment throws INTEGRATION_FAILED when adapter fails and persists error', async () => {
    const { enrolment } = await seedCompletedEnrolment();
    spies.certificate.failNext = true;

    await expect(
      issueForEnrollment({
        enrollmentId: enrolment._id,
        actor: 'admin',
      }),
    ).rejects.toMatchObject({ code: 'INTEGRATION_FAILED', status: 502 });

    const refreshed = await Enrollment.findById(enrolment._id);
    expect(refreshed?.certificateUrl).toBeNull();
    expect(refreshed?.certificateIssueError).toContain('Spy certificate failure');

    const audit = await AuditLog.findOne({
      action: 'certificate.issue_failed',
      targetId: enrolment._id,
    });
    expect(audit).not.toBeNull();
  });

  it('issueForEnrollment rejects 409 if enrolment not completed', async () => {
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id });
    const batch = await makeBatch({ programId: program._id });
    const { user: student } = await makeStudent();
    const enrolment = await makeEnrollment({
      studentId: student._id,
      batchId: batch._id,
      courseId: course._id,
      programId: program._id,
    });
    // Intentionally NOT setting completed=true.
    await expect(
      issueForEnrollment({ enrollmentId: enrolment._id, actor: 'admin' }),
    ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_COMPLETED', status: 409 });
  });

  it('listCertificatesForStudent returns issued certs for the student', async () => {
    const { student, enrolment } = await seedCompletedEnrolment();
    await issueForEnrollment({ enrollmentId: enrolment._id, actor: 'admin' });
    const list = await listCertificatesForStudent(student._id);
    expect(list).toHaveLength(1);
    expect(list[0]!.certificateUrl).not.toBeNull();
    expect(list[0]!.issuedAt).not.toBeNull();
  });

  it('countIssuedCertificatesForStudent returns count + latest issued date', async () => {
    const { student, enrolment } = await seedCompletedEnrolment();
    const counted = await countIssuedCertificatesForStudent(student._id);
    expect(counted.count).toBe(0);
    expect(counted.latestIssuedAt).toBeNull();
    await issueForEnrollment({ enrollmentId: enrolment._id, actor: 'admin' });
    const counted2 = await countIssuedCertificatesForStudent(student._id);
    expect(counted2.count).toBe(1);
    expect(counted2.latestIssuedAt).not.toBeNull();
  });

  it('registerCertificateListener is single-flight — calling twice adds one listener', async () => {
    clearListeners('course.completed');
    resetCertificateListenerRegistration();
    registerCertificateListener();
    registerCertificateListener();

    const { enrolment } = await seedCompletedEnrolment();
    await publishDomainEvent('course.completed', {
      enrolmentId: enrolment._id.toString(),
    });
    // One adapter call despite double registration.
    expect(spies.certificate.calls).toHaveLength(1);

    // Cleanup for subsequent tests.
    clearListeners('course.completed');
    resetCertificateListenerRegistration();
  });
});
