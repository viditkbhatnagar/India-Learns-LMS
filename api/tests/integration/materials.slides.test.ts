import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { useIntegrationSpies } from '../helpers/integrations.js';
import { http } from '../helpers/http.js';
import { bearer, tokenFor } from '../helpers/auth.js';
import { makeCourse, makeFaculty, makeProgram } from '../helpers/factories.js';
import { makePptx } from '../helpers/zip.js';
import { Material, type HydratedMaterial } from '../../src/models/index.js';

/**
 * Regression cover for the "Replace deck (JSON)" corruption + crash.
 *
 * Bug: PUT /v1/materials/:id/slides only checked that the payload was a
 * non-empty array — it persisted any array of any objects. A PowerPoint
 * converted to JSON (or any foreign deck) was stored verbatim, the slide
 * count jumped, and the viewer then crashed with
 * "Cannot read properties of undefined (reading 'title')" and could no
 * longer be opened. The fix validates that every slide is an object with
 * a `content` object before persisting. These tests lock that contract
 * and prove a rejected payload does NOT mutate the stored deck.
 */

function validSlide(n: number): Record<string, unknown> {
  return {
    slideNumber: n,
    slideType: 'bullets',
    title: `Slide ${n}`,
    content: { type: 'bullets', title: `Slide ${n}`, content: ['alpha', 'beta'] },
    speakerNotes: '',
  };
}

async function makeSlidesMaterial(courseId: Types.ObjectId): Promise<HydratedMaterial> {
  return Material.create({
    courseId,
    sessionId: new Types.ObjectId(), // satisfies the "exactly one scope" rule
    type: 'slides',
    title: 'Who Works at the Airport?',
    body: [validSlide(1)],
    slideCount: 1,
    uploadedAt: new Date(),
  });
}

describe('PUT /v1/materials/:id/slides — replace deck', () => {
  useMongo();
  useIntegrationSpies();

  // Writing slides requires the actor to be on the course faculty roster —
  // admins/superadmins not on the roster are read-only (OVERSIGHT_READONLY).
  async function setup() {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [fac._id] });
    const material = await makeSlidesMaterial(course._id);
    return { at, material };
  }

  it('replaces the deck with a valid slide array and bumps slideCount', async () => {
    const { at, material } = await setup();
    const next = [validSlide(1), validSlide(2), validSlide(3)];

    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send(next);

    expect(res.status).toBe(200);
    expect(res.body.data.material.slideCount).toBe(3);
    expect(Array.isArray(res.body.data.material.body)).toBe(true);
    expect(res.body.data.material.body).toHaveLength(3);

    const reloaded = await Material.findById(material._id).lean();
    expect(reloaded?.slideCount).toBe(3);
    expect((reloaded?.body as unknown[]).length).toBe(3);
  });

  it('accepts the { slides: [...] } wrapper shape', async () => {
    const { at, material } = await setup();
    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send({ slides: [validSlide(1), validSlide(2)] });

    expect(res.status).toBe(200);
    expect(res.body.data.material.slideCount).toBe(2);
  });

  it('rejects an empty array (422) and does not change the deck', async () => {
    const { at, material } = await setup();
    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send([]);

    expect(res.status).toBe(422);
    const reloaded = await Material.findById(material._id).lean();
    expect(reloaded?.slideCount).toBe(1);
  });

  it('rejects a non-array / non-{slides} body (422)', async () => {
    const { at, material } = await setup();
    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send({ foo: 'bar' });

    expect(res.status).toBe(422);
  });

  it('rejects a slide missing a content object (422) and leaves the deck intact', async () => {
    const { at, material } = await setup();
    // The corruption vector: a foreign deck whose objects have no `content`.
    const corrupt = [
      { slideNumber: 1, slideType: 'x', title: 'No content here' },
      { id: 2, type: 'pptx-shape', data: { foo: 'bar' } },
    ];

    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send(corrupt);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/content/i);
    expect(res.body.error.message).toMatch(/slide 1/i);

    // Critical: the original deck must be untouched (no corruption persisted).
    const reloaded = await Material.findById(material._id).lean();
    expect(reloaded?.slideCount).toBe(1);
    expect((reloaded?.body as Array<{ title?: string }>)[0]?.title).toBe('Slide 1');
  });

  it('rejects an array of primitives (422)', async () => {
    const { at, material } = await setup();
    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send(['just', 'some', 'strings']);

    expect(res.status).toBe(422);
  });

  it('names the first offending slide when a later slide is bad', async () => {
    const { at, material } = await setup();
    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send([validSlide(1), { slideNumber: 2, title: 'broken — no content' }]);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/slide 2/i);
  });

  it('imports a PowerPoint (.pptx) as the rendered deck', async () => {
    const { at, material } = await setup();
    const pptx = makePptx([
      { title: 'Who Works at the Airport?', lines: ['MOD101 · Lesson 1'] },
      { title: 'Learning Objectives', lines: ['Identify stakeholders', 'Explain hand-offs'] },
    ]);

    const res = await http()
      .post(`/v1/materials/${material._id.toString()}/slides/import-pptx`)
      .set(bearer(at))
      .attach('file', pptx, 'deck.pptx');

    expect(res.status).toBe(200);
    expect(res.body.data.material.slideCount).toBe(2);
    const body = res.body.data.material.body as Array<{ title: string; content: unknown }>;
    expect(body).toHaveLength(2);
    expect(body[0].title).toBe('Who Works at the Airport?');
    expect(typeof body[0].content).toBe('object');
    expect(Array.isArray(body[0].content)).toBe(false);
  });

  it('rejects a non-PowerPoint upload (422) and leaves the deck intact', async () => {
    const { at, material } = await setup();
    const res = await http()
      .post(`/v1/materials/${material._id.toString()}/slides/import-pptx`)
      .set(bearer(at))
      .attach('file', Buffer.from('this is not a pptx'), 'deck.pptx');

    expect(res.status).toBe(422);
    const reloaded = await Material.findById(material._id).lean();
    expect(reloaded?.slideCount).toBe(1); // original deck untouched
  });

  it('rejects a PowerPoint that has no slides with text (422)', async () => {
    const { at, material } = await setup();
    const empty = makePptx([{ title: '', lines: [] }]);
    const res = await http()
      .post(`/v1/materials/${material._id.toString()}/slides/import-pptx`)
      .set(bearer(at))
      .attach('file', empty, 'empty.pptx');

    expect(res.status).toBe(422);
  });

  it('returns 409 for a non-slides material', async () => {
    const { at, material } = await setup();
    material.type = 'reading';
    await material.save();

    const res = await http()
      .put(`/v1/materials/${material._id.toString()}/slides`)
      .set(bearer(at))
      .send([validSlide(1)]);

    expect(res.status).toBe(409);
  });
});

describe('DELETE /v1/materials/:id — remove a material', () => {
  useMongo();
  useIntegrationSpies();

  async function setup() {
    const { user: fac } = await makeFaculty();
    const at = await tokenFor(fac);
    const program = await makeProgram();
    const course = await makeCourse({ programId: program._id, facultyIds: [fac._id] });
    const material = await makeSlidesMaterial(course._id);
    return { fac, at, course, material };
  }

  it('soft-deletes a material and it is no longer fetchable', async () => {
    const { at, material } = await setup();
    const id = material._id.toString();

    const res = await http().delete(`/v1/materials/${id}`).set(bearer(at));
    expect(res.status).toBe(200);

    const reloaded = await Material.findById(id);
    expect(reloaded?.deletedAt).toBeInstanceOf(Date); // soft-deleted, not hard-removed

    const getRes = await http().get(`/v1/materials/${id}`).set(bearer(at));
    expect(getRes.status).toBe(404); // gone from the staff fetch
  });

  it('returns 404 for a non-existent material', async () => {
    const { at } = await setup();
    const res = await http()
      .delete(`/v1/materials/${new Types.ObjectId().toString()}`)
      .set(bearer(at));
    expect(res.status).toBe(404);
  });

  it('blocks a faculty member who is not on the course roster (403)', async () => {
    const { material } = await setup();
    const { user: outsider } = await makeFaculty();
    const outsiderAt = await tokenFor(outsider);

    const res = await http()
      .delete(`/v1/materials/${material._id.toString()}`)
      .set(bearer(outsiderAt));
    expect(res.status).toBe(403);
  });
});
