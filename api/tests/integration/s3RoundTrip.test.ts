import { describe, expect, it } from 'vitest';
import { useMongo } from '../helpers/db.js';

// Live S3 round-trip test for S3StorageAdapter.
//
// Gated behind `AWS_S3_INTEGRATION=1` because it talks to real AWS S3 and
// would fail in CI without credentials. Set these env vars before running:
//
//   AWS_S3_INTEGRATION=1
//   AWS_REGION=ap-south-1
//   AWS_S3_BUCKET=india-learns-lms-prod
//   AWS_ACCESS_KEY_ID=...
//   AWS_SECRET_ACCESS_KEY=...
//
// Run:  AWS_S3_INTEGRATION=1 AWS_S3_BUCKET=india-learns-lms-prod \
//       AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
//       npm test -w api -- tests/integration/s3RoundTrip.test.ts

const LIVE = process.env.AWS_S3_INTEGRATION === '1';
const describeLive = LIVE ? describe : describe.skip;

describeLive('S3StorageAdapter (live)', () => {
  useMongo();

  it('round-trips a small file: upload → signedUrl → fetch → delete', async () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.INTEGRATIONS_MODE = 'live';

    const { resetEnvCache } = await import('../../src/config/env.js');
    resetEnvCache();
    const { resetS3ClientCache } = await import(
      '../../src/integrations/s3StorageAdapter.js'
    );
    resetS3ClientCache();
    const { S3StorageAdapter, fetchS3File } = await import(
      '../../src/integrations/s3StorageAdapter.js'
    );
    const { FileMeta } = await import('../../src/models/fileMeta.js');

    const adapter = new S3StorageAdapter();
    const payload = Buffer.from(
      `india-learns S3 round-trip ${new Date().toISOString()}`,
    );

    const uploaded = await adapter.upload({
      bytes: payload,
      filename: 'roundtrip.txt',
      folder: 'ticket-attachments',
      contentType: 'text/plain; charset=utf-8',
    });

    expect(uploaded.key).toMatch(/^[a-f0-9]{24}$/);
    expect(uploaded.url).toMatch(
      new RegExp(`/v1/files/${uploaded.key}$`),
    );

    // FileMeta row was created and points at the right S3 key.
    const meta = await FileMeta.findById(uploaded.key);
    expect(meta).toBeTruthy();
    expect(meta?.s3Bucket).toBe(process.env.AWS_S3_BUCKET);
    expect(meta?.s3Key).toBe(`ticket-attachments/${uploaded.key}`);
    expect(meta?.size).toBe(payload.byteLength);

    // Signed URL is a real presigned S3 URL.
    const signed = await adapter.signedUrl(uploaded.key, 60);
    expect(signed).toContain('X-Amz-Signature');
    expect(signed).toContain(meta!.s3Key);

    // Fetch through the proxy helper (what /v1/files/:id uses).
    const fetched = await fetchS3File(uploaded.key);
    expect(fetched).toBeTruthy();
    expect(fetched!.contentType).toBe('text/plain; charset=utf-8');
    expect(fetched!.length).toBe(payload.byteLength);
    const chunks: Buffer[] = [];
    for await (const chunk of fetched!.stream) {
      chunks.push(chunk as Buffer);
    }
    const downloaded = Buffer.concat(chunks);
    expect(downloaded.equals(payload)).toBe(true);

    // Delete removes both S3 object and FileMeta row.
    await adapter.delete(uploaded.key);
    const afterDelete = await FileMeta.findById(uploaded.key);
    expect(afterDelete).toBeNull();
    const fetchedAfterDelete = await fetchS3File(uploaded.key);
    expect(fetchedAfterDelete).toBeNull();
  }, 30_000);
});
