import { deflateRawSync } from 'node:zlib';

/**
 * Build a minimal ZIP archive (DEFLATE, method 8) from name→content map.
 * CRC is left 0 — the app's pptx reader inflates by size and never verifies
 * CRC, so this is sufficient for parser tests and avoids a CRC dependency.
 */
export function makeZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(content, 'utf8');
    const comp = deflateRawSync(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method = deflate
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(0, 14); // crc (ignored by reader)
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    const localRec = Buffer.concat([local, nameBuf, comp]);
    locals.push(localRec);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16); // crc
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    centrals.push(Buffer.concat([central, nameBuf]));

    offset += localRec.length;
  }

  const localsBuf = Buffer.concat(locals);
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localsBuf.length, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([localsBuf, centralBuf, eocd]);
}

const xmlEsc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const para = (text: string): string => `<a:p><a:r><a:t>${xmlEsc(text)}</a:t></a:r></a:p>`;

function slideXml(title: string, lines: string[], opts: { titlePlaceholder?: boolean } = {}): string {
  const ph = opts.titlePlaceholder === false ? '' : '<p:ph type="title"/>';
  const titleSp = title
    ? `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody>${para(title)}</p:txBody></p:sp>`
    : '';
  const bodySp = lines.length
    ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>${lines.map(para).join('')}</p:txBody></p:sp>`
    : '';
  return `<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>${titleSp}${bodySp}</p:spTree></p:cSld></p:sld>`;
}

/**
 * Build a minimal but valid-enough .pptx for parser tests: presentation.xml +
 * its rels + one slideN.xml per spec, with the rels ordering reversed so the
 * test proves we honour presentation order (not filename order).
 */
export function makePptx(
  slides: Array<{ title: string; lines: string[]; titlePlaceholder?: boolean }>,
): Buffer {
  const files: Record<string, string> = {};
  const sldIds: string[] = [];
  const rels: string[] = [];
  slides.forEach((s, i) => {
    const n = i + 1;
    files[`ppt/slides/slide${n}.xml`] = slideXml(s.title, s.lines, { titlePlaceholder: s.titlePlaceholder });
    sldIds.push(`<p:sldId id="${255 + n}" r:id="rId${n}"/>`);
    rels.push(
      `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/>`,
    );
  });
  files['ppt/presentation.xml'] =
    `<?xml version="1.0"?><p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${sldIds.join('')}</p:sldIdLst></p:presentation>`;
  files['ppt/_rels/presentation.xml.rels'] =
    `<?xml version="1.0"?><Relationships>${rels.join('')}</Relationships>`;
  return makeZip(files);
}
