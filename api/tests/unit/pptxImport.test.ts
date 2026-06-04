import { describe, expect, it } from 'vitest';
import {
  decodeXmlEntities,
  extractSlideFromXml,
  parsePptxToSlides,
} from '../../src/services/pptxImport.js';
import { makePptx, makeZip } from '../helpers/zip.js';

describe('pptxImport: decodeXmlEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeXmlEntities('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;')).toBe(
      'a & b <c> "d" \'e\'',
    );
    expect(decodeXmlEntities('caf&#233; &#x2014; ok')).toBe('café — ok');
  });

  it('orders &amp; last so it does not double-decode', () => {
    // &amp;lt; must become "&lt;" (literal), not "<"
    expect(decodeXmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('pptxImport: extractSlideFromXml', () => {
  const sp = (ph: string, ...lines: string[]): string =>
    `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody>${lines
      .map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`)
      .join('')}</p:txBody></p:sp>`;

  it('uses a title placeholder as the heading and other shapes as body', () => {
    const xml = `<p:spTree>${sp('<p:ph type="title"/>', 'Heading')}${sp('<p:ph type="body"/>', 'one', 'two')}</p:spTree>`;
    expect(extractSlideFromXml(xml)).toEqual({ title: 'Heading', body: ['one', 'two'] });
  });

  it('falls back to the first line as heading when no title placeholder', () => {
    const xml = `<p:spTree>${sp('', 'First line is the title')}${sp('', 'bullet a', 'bullet b')}</p:spTree>`;
    expect(extractSlideFromXml(xml)).toEqual({
      title: 'First line is the title',
      body: ['bullet a', 'bullet b'],
    });
  });

  it('returns empty for a slide with no text', () => {
    expect(extractSlideFromXml('<p:spTree></p:spTree>')).toEqual({ title: '', body: [] });
  });

  it('joins run fragments within a paragraph and decodes entities', () => {
    const xml = '<p:sp><p:txBody><a:p><a:r><a:t>Hand-offs &amp; </a:t></a:r><a:r><a:t>handovers</a:t></a:r></a:p></p:txBody></p:sp>';
    expect(extractSlideFromXml(xml)).toEqual({ title: 'Hand-offs & handovers', body: [] });
  });
});

describe('pptxImport: parsePptxToSlides', () => {
  it('parses a deck into LMS slide shape, in presentation order', () => {
    const buf = makePptx([
      { title: 'Who Works at the Airport?', lines: ['MOD101 · Lesson 1'] },
      { title: 'Learning Objectives', lines: ['Identify stakeholders', 'Explain hand-offs', 'Describe coordination'] },
      { title: 'Summary', lines: ['Recap', 'Reflect'] },
    ]);
    const slides = parsePptxToSlides(buf);

    expect(slides).toHaveLength(3);
    expect(slides.map((s) => s.slideNumber)).toEqual([1, 2, 3]);
    expect(slides[0]).toMatchObject({
      slideType: 'title',
      title: 'Who Works at the Airport?',
      content: { type: 'title', title: 'Who Works at the Airport?', content: ['MOD101 · Lesson 1'] },
    });
    expect(slides[1]).toMatchObject({
      slideType: 'bullets',
      title: 'Learning Objectives',
      content: { content: ['Identify stakeholders', 'Explain hand-offs', 'Describe coordination'] },
    });
    // Every slide carries a content object — satisfies assertRenderableSlides.
    slides.forEach((s) => {
      expect(typeof s.content).toBe('object');
      expect(Array.isArray(s.content)).toBe(false);
    });
  });

  it('handles decks with no semantic title placeholders (first line = heading)', () => {
    const buf = makePptx([
      { title: 'Key Concept', lines: ['Coordination matters'], titlePlaceholder: false },
    ]);
    const [slide] = parsePptxToSlides(buf);
    expect(slide.title).toBe('Key Concept');
    expect(slide.content.content).toEqual(['Coordination matters']);
  });

  it('skips slides that contain no text', () => {
    const buf = makePptx([
      { title: 'Real', lines: ['has content'] },
      { title: '', lines: [] },
    ]);
    expect(parsePptxToSlides(buf)).toHaveLength(1);
  });

  it('throws on a buffer that is not a ZIP/PPTX', () => {
    expect(() => parsePptxToSlides(Buffer.from('this is not a zip file'))).toThrow();
  });

  it('returns [] for a ZIP with no slide parts', () => {
    const buf = makeZip({ 'docProps/core.xml': '<x/>' });
    expect(parsePptxToSlides(buf)).toEqual([]);
  });

  it('skips a slide whose XML exceeds the per-slide size cap (CPU guard)', () => {
    const huge = 'x'.repeat(300 * 1024); // pushes the slide XML over the 256 KB cap
    const buf = makePptx([
      { title: 'Real', lines: ['ok'] },
      { title: 'Huge', lines: [huge] },
    ]);
    const slides = parsePptxToSlides(buf);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.title).toBe('Real');
  });
});
