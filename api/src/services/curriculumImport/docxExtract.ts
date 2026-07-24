import { inflateRawSync } from 'node:zlib';
import { HttpError } from '../../middleware/error.js';

// Minimal .docx → text extractor using only Node built-ins (a .docx is a ZIP
// whose word/document.xml holds the body). Avoids adding a docx-parsing
// dependency; see DEPENDENCY_REQUEST.md for the mammoth upgrade path if the
// heuristics here ever prove too thin. Output is one line per paragraph
// (including table cells), which is exactly what parseLessonPlan expects.

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

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
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lhNameLen = buf.readUInt16LE(localOff + 26);
      const lhExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lhNameLen + lhExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
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
  } catch {
    throw new HttpError(422, 'BAD_DOCX', 'Could not read the Word file — please upload a valid .docx.');
  }
  if (!xmlBuf) {
    throw new HttpError(422, 'BAD_DOCX', 'That does not look like a Word .docx file.');
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
      const runs = [...withBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) =>
        decodeXmlEntities(m[1] ?? ''),
      );
      return runs.join('').replace(/\s+/g, ' ').trim();
    });
  return paras.join('\n');
}
