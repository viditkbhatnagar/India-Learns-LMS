import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { ShowcaseDocument } from '../../src/models/index.js';
import { HttpError } from '../../src/middleware/error.js';
import {
  findActiveShowcaseDocumentById,
  listActiveShowcaseDocuments,
  toShowcaseDocumentDto,
  upsertShowcaseDocumentBySlug,
} from '../../src/services/showcaseService.js';

const id24 = (c: string): string => c.repeat(24);

describe('showcaseService', () => {
  useMongo();

  it('lists only active docs, ordered by `order` ascending', async () => {
    await ShowcaseDocument.create({
      slug: 'b', title: 'B', category: 'program', fileId: id24('a'), order: 2, active: true,
    });
    await ShowcaseDocument.create({
      slug: 'a', title: 'A', category: 'profile', fileId: id24('b'), order: 0, active: true,
    });
    await ShowcaseDocument.create({
      slug: 'hidden', title: 'H', category: 'other', fileId: id24('c'), order: 1, active: false,
    });

    const docs = await listActiveShowcaseDocuments();
    expect(docs.map((d) => d.slug)).toEqual(['a', 'b']);
  });

  it('maps a doc to a DTO with fileId + ISO updatedAt', async () => {
    const doc = await ShowcaseDocument.create({
      slug: 's', title: 'T', description: 'D', category: 'profile', fileId: id24('f'),
      contentType: 'application/pdf', sizeBytes: 123, originalFilename: 'x.pdf', order: 0,
      active: true,
    });
    const dto = toShowcaseDocumentDto(doc);
    expect(dto).toMatchObject({
      slug: 's', title: 'T', description: 'D', category: 'profile',
      contentType: 'application/pdf', sizeBytes: 123, originalFilename: 'x.pdf', order: 0,
    });
    // fileId (the raw GridFS id) is deliberately NOT exposed in the DTO.
    expect(dto).not.toHaveProperty('fileId');
    expect(typeof dto.id).toBe('string');
    expect(dto.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('upserts by slug: creates once, then updates in place', async () => {
    const first = await upsertShowcaseDocumentBySlug({
      slug: 'p', title: 'One', description: '', category: 'profile', fileId: id24('1'),
      contentType: 'application/pdf', sizeBytes: 1, originalFilename: 'a.pdf', order: 0,
    });
    expect(first.created).toBe(true);

    const second = await upsertShowcaseDocumentBySlug({
      slug: 'p', title: 'Two', description: 'updated', category: 'program', fileId: id24('2'),
      contentType: 'application/pdf', sizeBytes: 2, originalFilename: 'b.pdf', order: 3,
    });
    expect(second.created).toBe(false);
    expect(second.doc.title).toBe('Two');
    expect(second.doc.fileId).toBe(id24('2'));
    expect(await ShowcaseDocument.countDocuments({ slug: 'p' })).toBe(1);
  });

  it('re-activates a soft-disabled doc on upsert', async () => {
    await ShowcaseDocument.create({
      slug: 'z', title: 'Z', category: 'other', fileId: id24('9'), order: 0, active: false,
    });
    const { doc } = await upsertShowcaseDocumentBySlug({
      slug: 'z', title: 'Z2', description: '', category: 'other', fileId: id24('8'),
      contentType: 'application/pdf', sizeBytes: 5, originalFilename: 'z.pdf', order: 0,
    });
    expect(doc.active).toBe(true);
  });

  it('findActiveShowcaseDocumentById throws 404 for inactive / missing / invalid ids', async () => {
    const inactive = await ShowcaseDocument.create({
      slug: 'x', title: 'X', category: 'other', fileId: id24('9'), order: 0, active: false,
    });
    await expect(findActiveShowcaseDocumentById(String(inactive._id))).rejects.toBeInstanceOf(HttpError);
    await expect(findActiveShowcaseDocumentById(id24('0'))).rejects.toBeInstanceOf(HttpError);
    await expect(findActiveShowcaseDocumentById('not-an-object-id')).rejects.toBeInstanceOf(HttpError);
  });
});
