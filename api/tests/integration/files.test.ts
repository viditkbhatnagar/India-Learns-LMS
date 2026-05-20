import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeStudent } from '../helpers/factories.js';

// M10q — Integration tests for the generic `/v1/files/upload` endpoint.
// Exercises multer parsing, folder validation, auth gating, and the
// configured StorageAdapter (the spy in tests, MongoStorageAdapter in
// production). GET /v1/files/:id is exercised indirectly via the spy
// returning a `https://spy.test/...` URL — the real GridFS stream code
// is covered by the adapter's own bytes round-trip in storageService
// integration tests.

describe('POST /v1/files/upload', () => {
  useMongo();
  const spies = useIntegrationSpies();

  it('admin uploads a file and gets {url, key}', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/files/upload?folder=student-documents')
      .set(bearer(at))
      .attach('file', Buffer.from('hello world'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^https:\/\/spy\.test\/student-documents\//);
    expect(res.body.data.key).toMatch(/^stub:student-documents:/);
    expect(spies.storage.uploads.length).toBe(1);
    const u = spies.storage.uploads[0]!;
    expect(u.folder).toBe('student-documents');
    expect(u.filename).toBe('hello.txt');
    expect(u.contentType).toBe('text/plain');
    expect(Buffer.from(u.bytes!).toString('utf8')).toBe('hello world');
  });

  it('student can upload to chat-attachments', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http()
      .post('/v1/files/upload?folder=chat-attachments')
      .set(bearer(at))
      .attach('file', Buffer.from('attachment-bytes'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(201);
    expect(spies.storage.uploads.length).toBe(1);
  });

  it('student can upload their own resume', async () => {
    const { user: stu } = await makeStudent();
    const at = await tokenFor(stu);
    const res = await http()
      .post('/v1/files/upload?folder=resumes')
      .set(bearer(at))
      .attach('file', Buffer.from('%PDF-1.4 fake'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);
  });

  it('rejects an unknown folder with 422', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/files/upload?folder=not-a-folder')
      .set(bearer(at))
      .attach('file', Buffer.from('x'), { filename: 'x', contentType: 'text/plain' });
    expect(res.status).toBe(422);
    expect(spies.storage.uploads.length).toBe(0);
  });

  it('rejects missing folder query with 422', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/files/upload')
      .set(bearer(at))
      .attach('file', Buffer.from('x'), { filename: 'x', contentType: 'text/plain' });
    expect(res.status).toBe(422);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await http()
      .post('/v1/files/upload?folder=chat-attachments')
      .attach('file', Buffer.from('x'), { filename: 'x', contentType: 'text/plain' });
    expect(res.status).toBe(401);
  });

  it('rejects multipart with no file field with 422', async () => {
    const { user: admin } = await makeAdmin();
    const at = await tokenFor(admin);
    const res = await http()
      .post('/v1/files/upload?folder=chat-attachments')
      .set(bearer(at))
      .field('decoy', 'value');
    expect(res.status).toBe(422);
  });
});
