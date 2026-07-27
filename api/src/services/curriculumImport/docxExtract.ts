import { inflateRawSync } from 'node:zlib';
import { HttpError } from '../../middleware/error.js';

// Minimal .docx → text extractor using only Node built-ins (a .docx is a ZIP
// whose word/document.xml holds the body). Avoids adding a docx-parsing
// dependency; see DEPENDENCY_REQUEST.md for the mammoth upgrade path if the
// heuristics here ever prove too thin. Output is one line per paragraph
// (including table cells), which is exactly what parseLessonPlan expects.

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
// Same hard caps the pptx importer uses — a real lesson-plan document.xml is
// well under 1 MB, so these only ever fire on a malformed file or a zip bomb.
const MAX_ENTRY_BYTES = 16 * 1024 * 1024; // per-part inflate cap (OOM guard)
const MAX_XML_BYTES = 16 * 1024 * 1024; // cap regex input (CPU guard)

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - (0xffff + 22));
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

/** Read one entry from a ZIP by name via the central directory (robust). */
function readZipEntry(buf: Buffer, wanted: string): Buffer | null {
  const eocd = findEocd(buf);
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16); // central directory offset
  for (let i = 0; i < count && p + 46 <= buf.length; i += 1) {
    if (buf.readUInt32LE(p) !== CEN_SIG) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      // Reject an absurd declared size BEFORE inflating (zip-bomb guard).
      if (uncompSize > MAX_ENTRY_BYTES) {
        throw new HttpError(422, 'BAD_DOCX', 'That Word file is too large to process.');
      }
      if (localOff + 30 > buf.length) return null; // header points outside the buffer
      const lhNameLen = buf.readUInt16LE(localOff + 26);
      const lhExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      // maxOutputLength stops a small archive inflating to gigabytes.
      return method === 0
        ? Buffer.from(data)
        : inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function extractDocxText(buf: Buffer): string {
  let xmlBuf: Buffer | null;
  try {
    xmlBuf = readZipEntry(buf, 'word/document.xml');
  } catch (err) {
    // Includes inflate blowing the maxOutputLength cap — never leak the raw
    // zlib error, and never let it escape as a 500.
    if (err instanceof HttpError) throw err;
    throw new HttpError(422, 'BAD_DOCX', 'Could not read the Word file — please upload a valid .docx.');
  }
  if (!xmlBuf) {
    throw new HttpError(422, 'BAD_DOCX', 'That does not look like a Word .docx file.');
  }
  if (xmlBuf.length > MAX_XML_BYTES) {
    throw new HttpError(422, 'BAD_DOCX', 'That Word file is too large to process.');
  }
  const xml = xmlBuf.toString('utf8');
  // One line per <w:p> paragraph; concatenate its <w:t> text runs. Tabs/breaks
  // inside a run become spaces so a heading never gets split across lines.
  const paras = xml
    .split(/<w:p[\s>]/)
    .slice(1)
    .map((chunk) => {
      const body = chunk.split('</w:p>')[0] ?? chunk;
      const withBreaks = body.replace(/<w:(tab|br|cr)\b[^>]*\/?>/g, ' ');
      // `[^<]*`, not a lazy catch-all: <w:t> holds character data only, so this
      // is equivalent but linear — the lazy version backtracks quadratically on
      // a crafted (or just large) document and blocks the event loop.
      const runs = [...withBreaks.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) =>
        decodeXmlEntities(m[1] ?? ''),
      );
      return runs.join('').replace(/\s+/g, ' ').trim();
    });
  return paras.join('\n');
}
