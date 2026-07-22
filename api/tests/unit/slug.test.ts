import { describe, expect, it } from 'vitest';
import { slugify, slugSchema } from '../../src/utils/slug.js';

describe('slugify', () => {
  it('lowercases, hyphenates spaces, and drops punctuation', () => {
    expect(slugify('Diploma in Fashion & Retail Management')).toBe(
      'diploma-in-fashion-retail-management',
    );
  });

  it('fixes the exact reported case (space instead of a hyphen)', () => {
    expect(slugify('retail management-diploma')).toBe('retail-management-diploma');
  });

  it('collapses repeats and trims leading/trailing hyphens', () => {
    expect(slugify('  --Hello___World--  ')).toBe('hello-world');
  });

  it('strips accents', () => {
    expect(slugify('Résumé Prögram')).toBe('resume-program');
  });

  it('returns empty when nothing usable remains', () => {
    expect(slugify('   ---   ')).toBe('');
  });
});

describe('slugSchema', () => {
  it('normalizes a loosely-typed slug', () => {
    expect(slugSchema.parse('retail management-diploma')).toBe('retail-management-diploma');
  });

  it('rejects a slug with no letters or numbers', () => {
    const result = slugSchema.safeParse('   ---   ');
    expect(result.success).toBe(false);
  });
});
