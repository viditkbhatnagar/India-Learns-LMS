import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type {
  CertificateAdapter,
  CertificateIssueInput,
  CertificateIssueResult,
} from 'india-learns-shared-types';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';

// M8 — Certifier.io adapter (TRD §9.4). Idempotency key is the enrolment _id.
// Dev stub returns a deterministic URL so tests can assert round-trip without
// network access; re-calling with the same key yields the same URL.
export class ConsoleCertificateAdapter implements CertificateAdapter {
  async issue(input: CertificateIssueInput): Promise<CertificateIssueResult> {
    const hash = createHash('sha1')
      .update(input.idempotencyKey)
      .digest('hex')
      .slice(0, 16);
    const certificateUrl = `https://stub.indialearns.com/cert/${hash}`;
    const providerId = `stub-${hash}`;
    logger.info(
      {
        idempotencyKey: input.idempotencyKey,
        studentName: input.studentName,
        courseName: input.courseName,
        templateId: input.templateId,
        providerId,
        certificateUrl,
      },
      'certificate.issue.stub',
    );
    return { certificateUrl, providerId };
  }
}

// Live Certifier.io adapter — POST to `/v1/credentials` with bearer auth and
// the enrolment id as the external-id so re-issues dedupe upstream. The live
// wire is gated behind CERTIFIER_ENABLED; until Logan delivers the API key
// (Q-PENDING-08) the factory picks the console stub instead.
export class CertifierIoAdapter implements CertificateAdapter {
  async issue(input: CertificateIssueInput): Promise<CertificateIssueResult> {
    const env = loadEnv();
    if (!env.CERTIFIER_API_KEY) {
      throw new Error('CERTIFIER_API_KEY is required when CERTIFIER_ENABLED=true');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch('https://api.certifier.io/v1/credentials', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.CERTIFIER_API_KEY}`,
          'content-type': 'application/json',
          'idempotency-key': input.idempotencyKey,
        },
        body: JSON.stringify({
          template_id: input.templateId || env.CERTIFIER_DEFAULT_TEMPLATE_ID,
          recipient: {
            name: input.studentName,
            email: input.email,
          },
          custom_attributes: {
            course_name: input.courseName,
            completion_date: input.completionDate.toISOString().slice(0, 10),
          },
          external_id: input.idempotencyKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Certifier responded ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        id?: string;
        public_url?: string;
        certificate_url?: string;
      };
      const providerId = json.id ?? `certifier-${nanoid(10)}`;
      const certificateUrl =
        json.public_url ?? json.certificate_url ?? 'https://certifier.io/credentials/unknown';
      return { certificateUrl, providerId };
    } finally {
      clearTimeout(timeout);
    }
  }
}
