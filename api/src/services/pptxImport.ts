import { inflateRawSync } from 'node:zlib';

/**
 * Server-side PowerPoint (.pptx) → LMS slide deck.
 *
 * A .pptx is a ZIP of XML parts. We read it with Node's built-in zlib (no
 * new dependency, per the project's dependency policy), extract the text of
 * each slide, and map it into the exact shape the slide viewer renders and
 * `assertRenderableSlides` accepts:
 *   { slideNumber, slideType, title, content: { type, title, content[] }, speakerNotes }
 *
 * Scope (v1): text only — titles + bullet lines, in slide order. Images,
 * tables, charts and animations are ignored; speaker notes are left empty.
 * Faculty wanting the original file downloadable still use "Upload
 * PowerPoint / PDF" (that attaches a file material). This path renders the
 * deck so students see the slides inline.
 */

export type ParsedSlideType = 'title' | 'bullets';

export interface ParsedSlide {
  slideNumber: number;
  slideType: ParsedSlideType;
  title: string;
  content: { type: ParsedSlideType; title: string; content: string[] };
  speakerNotes: string;
}

const MAX_SLIDES = 500;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024; // per-part inflate hard cap
const MAX_TOTAL_INFLATED_BYTES = 32 * 1024 * 1024; // aggregate across the archive — OOM / zip-bomb guard
const MAX_SLIDE_XML_BYTES = 256 * 1024; // cap regex input per slide — CPU guard

// --- Minimal ZIP reader: walk the central directory, inflate only the parts
// we need. Skipping media/theme parts keeps cost bounded on large decks. ---
function readZipEntries(buf: Buffer, wanted: (name: string) => boolean): Map<string, string> {
  let eocd = -1;
  const floor = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= floor; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive (no end-of-central-directory record).');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, string>();
  let totalInflated = 0;

  for (let n = 0; n < count; n += 1) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    if (wanted(name)) {
      if (localOff + 30 > buf.length) break; // local header points outside the buffer
      const lhNameLen = buf.readUInt16LE(localOff + 26);
      const lhExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const comp = buf.subarray(dataStart, dataStart + compSize);
      let data: Buffer;
      if (method === 0) data = comp;
      else if (method === 8) data = inflateRawSync(comp, { maxOutputLength: MAX_ENTRY_BYTES });
      else throw new Error(`Unsupported ZIP compression method ${method}.`);
      totalInflated += data.length;
      if (totalInflated > MAX_TOTAL_INFLATED_BYTES) {
        throw new Error('PowerPoint decompressed content exceeds the allowed size.');
      }
      out.set(name, data.toString('utf8'));
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : '';
  } catch {
    return '';
  }
}

// A <a:p> paragraph becomes one line: its <a:t> text runs, concatenated.
function paragraphLines(xml: string): string[] {
  const paras = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [];
  const lines: string[] = [];
  for (const p of paras) {
    const runs = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
    const line = decodeXmlEntities(runs.join('')).replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Pure: one slide's XML → its heading + body lines. Title comes from a
 * title/ctrTitle/subTitle placeholder when present; otherwise the first
 * text line becomes the heading (many decks don't tag placeholders
 * semantically). Exposed for unit testing.
 */
export function extractSlideFromXml(slideXml: string): { title: string; body: string[] } {
  const shapes = slideXml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? [];
  let title = '';
  const body: string[] = [];
  for (const sp of shapes) {
    const isTitlePlaceholder = /<p:ph\b[^>]*type="(?:ctrTitle|title|subTitle)"/.test(sp);
    const lines = paragraphLines(sp);
    if (lines.length === 0) continue;
    if (isTitlePlaceholder && !title) title = lines.join(' ');
    else body.push(...lines);
  }
  if (!title && body.length > 0) title = body.shift() as string;
  return { title, body };
}

function resolveTarget(target: string): string {
  const t = target.replace(/^\/+/, '').replace(/^(\.\.\/)+/, '');
  return t.startsWith('ppt/') ? t : `ppt/${t}`;
}

// Slide render order is defined by presentation.xml's <p:sldIdLst>, mapped
// through the rels file. Fall back to numeric filename order if either part
// is missing or yields nothing.
function slidePathsInOrder(entries: Map<string, string>): string[] {
  const numeric = (): string[] =>
    [...entries.keys()]
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => Number(a.match(/(\d+)/)![1]) - Number(b.match(/(\d+)/)![1]));

  const pres = entries.get('ppt/presentation.xml');
  const rels = entries.get('ppt/_rels/presentation.xml.rels');
  if (!pres || !rels) return numeric();

  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const id = m[1];
    const target = m[2];
    if (id && target) relMap.set(id, resolveTarget(target));
  }
  const ordered: string[] = [];
  for (const m of pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)) {
    const id = m[1];
    if (!id) continue;
    const path = relMap.get(id);
    if (path && entries.has(path)) ordered.push(path);
  }
  return ordered.length > 0 ? ordered : numeric();
}

/**
 * Parse a .pptx buffer into LMS slides. Throws if the buffer is not a
 * readable ZIP/PPTX. Returns [] if there are no slides with text.
 */
export function parsePptxToSlides(buf: Buffer): ParsedSlide[] {
  const entries = readZipEntries(
    buf,
    (name) =>
      name === 'ppt/presentation.xml'
      || name === 'ppt/_rels/presentation.xml.rels'
      || /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );

  const paths = slidePathsInOrder(entries).slice(0, MAX_SLIDES);
  const slides: ParsedSlide[] = [];
  paths.forEach((path, i) => {
    const xml = entries.get(path);
    if (!xml || xml.length > MAX_SLIDE_XML_BYTES) return; // skip missing / oversized parts
    const { title, body } = extractSlideFromXml(xml);
    if (!title && body.length === 0) return; // skip empty/section-divider slides
    const type: ParsedSlideType = i === 0 && body.length <= 2 ? 'title' : 'bullets';
    slides.push({
      slideNumber: slides.length + 1,
      slideType: type,
      title,
      content: { type, title, content: body },
      speakerNotes: '',
    });
  });
  return slides;
}
