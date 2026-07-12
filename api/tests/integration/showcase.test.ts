import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeAdmin, makeFaculty, makeStudent } from '../helpers/factories.js';
import { ShowcaseDocument } from '../../src/models/index.js';
import { MongoStorageAdapter } from '../../src/integrations/mongoStorageAdapter.js';

const id24 = (c: string): string => c.repeat(24);

interface SeedOverrides {
  slug?: string;
  title?: string;
  active?: boolean;
  fileId?: string;
  order?: number;
}

async function seedDoc(overrides: SeedOverrides = {}) {
  return ShowcaseDocument.create({
    slug: overrides.slug ?? 'india-learns-profile',
    title: overrides.title ?? 'India Learns — Company Profile',
    description: 'Profile',
    category: 'profile',
    fileId: overrides.fileId ?? id24('a'),
    contentType: 'application/pdf',
    sizeBytes: 1000,
    originalFilename: 'p.pdf',
    order: overrides.order ?? 0,
    active: overrides.active ?? true,
  });
}

describe('GET /v1/showcase', () => {
  useMongo();
  useIntegrationSpies();

  it('admin lists only active showcase docs', async () => {
    await seedDoc();
    await seedDoc({ slug: 'hidden', title: 'Hidden', active: false, fileId: id24('b') });
    const { user } = await makeAdmin();
    const at = await tokenFor(user);

    const res = await http().get('/v1/showcase').set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].category).toBe('profile');
    expect(res.body.data.items[0].slug).toBe('india-learns-profile');
    // The raw GridFS fileId must never be exposed to the client.
    expect(res.body.data.items[0]).not.toHaveProperty('fileId');
  });

  it('faculty can list', async () => {
    await seedDoc();
    const { user } = await makeFaculty();
    const at = await tokenFor(user);
    const res = await http().get('/v1/showcase').set(bearer(at));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('student is forbidden (403)', async () => {
    await seedDoc();
    const { user } = await makeStudent();
    const at = await tokenFor(user);
    const res = await http().get('/v1/showcase').set(bearer(at));
    expect(res.status).toBe(403);
  });

  it('unauthenticated request is 401', async () => {
    const res = await http().get('/v1/showcase');
    expect(res.status).toBe(401);
  });

  it('GET /:id returns a single active doc; 404 for inactive', async () => {
    const doc = await seedDoc();
    const off = await seedDoc({ slug: 'off', title: 'Off', active: false, fileId: id24('c') });
    const { user } = await makeAdmin();
    const at = await tokenFor(user);

    const ok = await http().get(`/v1/showcase/${doc._id}`).set(bearer(at));
    expect(ok.status).toBe(200);
    expect(ok.body.data.document.slug).toBe('india-learns-profile');

    const notFound = await http().get(`/v1/showcase/${off._id}`).set(bearer(at));
    expect(notFound.status).toBe(404);
  });

  it('GET /:id/file streams the PDF bytes to staff, resolving the fileId server-side', async () => {
    // Put real bytes in GridFS, then point a ShowcaseDocument at them.
    const bytes = Buffer.from('%PDF-1.4 fake showcase bytes for the test');
    const { key } = await new MongoStorageAdapter().upload({
      bytes,
      filename: 'profile.pdf',
      folder: 'showcase',
      contentType: 'application/pdf',
    });
    const doc = await seedDoc({ fileId: key });
    const { user } = await makeFaculty();
    const at = await tokenFor(user);

    const res = await http().get(`/v1/showcase/${doc._id}/file`).set(bearer(at)).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-length']).toBe(String(bytes.length));
  });

  // The byte-serving route inherits the router's staff gate, so students are
  // rejected at the middleware BEFORE any file lookup — this closes the
  // "students must never see it" requirement at the byte layer.
  it('GET /:id/file is forbidden for students (403) — bytes are staff-gated', async () => {
    const doc = await seedDoc();
    const { user } = await makeStudent();
    const at = await tokenFor(user);
    const res = await http().get(`/v1/showcase/${doc._id}/file`).set(bearer(at));
    expect(res.status).toBe(403);
  });

  it('GET /:id/file is 401 for unauthenticated requests', async () => {
    const doc = await seedDoc();
    const res = await http().get(`/v1/showcase/${doc._id}/file`);
    expect(res.status).toBe(401);
  });

  it('GET /:id/file returns 404 when the doc exists but its bytes are missing', async () => {
    const doc = await seedDoc({ fileId: id24('d') }); // no GridFS object for this id
    const { user } = await makeAdmin();
    const at = await tokenFor(user);
    const res = await http().get(`/v1/showcase/${doc._id}/file`).set(bearer(at));
    expect(res.status).toBe(404);
  });
});
