import { describe, expect, it } from 'vitest';
import '../helpers/env.js';
import { useMongo } from '../helpers/db.js';
import { Program } from '../../src/models/index.js';

const PROGRAMS = [
  {
    slug: 'aviation-diploma',
    name: 'Aviation Diploma',
    description: 'India Learns 300-hour in-person Aviation Diploma.',
    totalHours: 300,
    isActive: true,
  },
  {
    slug: 'retail-fashion-diploma',
    name: 'Retail & Fashion Diploma',
    description: 'India Learns 300-hour in-person Retail & Fashion Diploma.',
    totalHours: 300,
    isActive: true,
  },
];

async function runSeed(): Promise<Array<{ slug: string; inserted: boolean }>> {
  return Promise.all(
    PROGRAMS.map(async (p) => {
      const res = await Program.updateOne(
        { slug: p.slug },
        { $setOnInsert: p },
        { upsert: true },
      );
      return { slug: p.slug, inserted: res.upsertedCount > 0 };
    }),
  );
}

describe('seed script', () => {
  useMongo();

  it('seeds two programs on an empty DB', async () => {
    const result = await runSeed();
    expect(result.filter((r) => r.inserted)).toHaveLength(2);
    const all = await Program.find({});
    expect(all).toHaveLength(2);
  });

  it('is idempotent — running again does not duplicate', async () => {
    await runSeed();
    await runSeed();
    const all = await Program.find({});
    expect(all).toHaveLength(2);
  });
});
