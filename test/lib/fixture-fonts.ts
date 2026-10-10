import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { inflateSync } from 'zlib';

// DejaVu Sans covers Latin, Greek and Cyrillic but not CJK, so it can render one script and warn on another.
const dejavuDir = join(dirname(createRequire(import.meta.url).resolve('dejavu-fonts-ttf/package.json')), 'ttf');
export const DEJAVU_SANS = join(dejavuDir, 'DejaVuSans.ttf');
export const DEJAVU_FACES = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf'];

export function embeddedFontNames(pdf: Buffer): string[] {
  return Array.from(pdf.toString('latin1').matchAll(/\/BaseFont \/(?:[A-Z]{6}\+)?([^\s/>]+)/g), (m) => m[1] as string);
}

export interface CollectionOptions {
  /** DejaVu face files, in collection order (default: regular, bold, oblique, bold oblique) */
  faces?: string[];
  /** Clear the OS/2 bold and italic flags, leaving weight class and italic angle to identify styles */
  clearStyleFlags?: boolean;
  /** File name without extension (default: DejaVuSans) */
  name?: string;
}

/**
 * Writes DejaVu Sans faces as one TrueType collection (`.ttc`) into `dir` and returns its path.
 * Each face keeps its own table directory; table data is copied and offsets rebased to the collection.
 */
export function writeDejaVuCollection(dir: string, options: CollectionOptions = {}): string {
  const { faces: faceFiles = DEJAVU_FACES, clearStyleFlags = false, name = 'DejaVuSans' } = options;
  const faces = faceFiles.map((file) => readFileSync(join(dejavuDir, file)));
  const headerSize = 12 + 4 * faces.length;
  const directorySizes = faces.map((f) => 12 + 16 * f.readUInt16BE(4));
  let dataOffset = headerSize + directorySizes.reduce((a, b) => a + b, 0);

  const header = Buffer.alloc(headerSize);
  header.write('ttcf', 0, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(faces.length, 8);
  const directories: Buffer[] = [];
  const tables: Buffer[] = [];
  let directoryOffset = headerSize;
  faces.forEach((face, i) => {
    header.writeUInt32BE(directoryOffset, 12 + 4 * i);
    const numTables = face.readUInt16BE(4);
    const directory = Buffer.from(face.subarray(0, 12 + 16 * numTables));
    for (let t = 0; t < numTables; t++) {
      const entry = 12 + 16 * t;
      const offset = face.readUInt32BE(entry + 8);
      const length = face.readUInt32BE(entry + 12);
      directory.writeUInt32BE(dataOffset, entry + 8);
      const padded = Buffer.alloc((length + 3) & ~3);
      face.copy(padded, 0, offset, offset + length);
      // OS/2 fsSelection (offset 62): bit 0 italic, bit 5 bold, bit 6 regular
      if (clearStyleFlags && face.toString('latin1', entry, entry + 4) === 'OS/2') padded.writeUInt16BE((padded.readUInt16BE(62) & ~0x21) | 0x40, 62);
      tables.push(padded);
      dataOffset += padded.length;
    }
    directories.push(directory);
    directoryOffset += directory.length;
  });

  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.ttc`);
  writeFileSync(path, Buffer.concat([header, ...directories, ...tables]));
  return path;
}

export interface TextRun {
  /** BaseFont without the subset prefix */
  font: string;
  /** PDF text render mode: 0 fill, 2 fill and stroke */
  mode: number;
  /** Drawn under a skew transform */
  oblique: boolean;
  /** Fill color operands, e.g. "1 0 0" */
  fill: string;
  /** Shown bytes as latin1; readable for standard fonts, glyph ids for embedded fonts */
  text: string;
  /** Baseline y from the text matrix, in PDF user space (larger is higher on the page) */
  y: number;
}

/** Text-showing operations in page content order, with the font, render mode and skew in effect. */
export function textRuns(pdf: Buffer): TextRun[] {
  const raw = pdf.toString('latin1');
  const baseFonts = new Map<string, string>();
  for (const m of raw.matchAll(/(\d+) 0 obj\s*<<([\s\S]*?)endobj/g)) {
    const name = /\/Type \/Font\b[\s\S]*?\/BaseFont \/(?:[A-Z]{6}\+)?(\S+)|\/BaseFont \/(?:[A-Z]{6}\+)?(\S+)[\s\S]*?\/Type \/Font\b/.exec(m[2] as string);
    if (name) baseFonts.set(m[1] as string, (name[1] ?? name[2]) as string);
  }
  const resources = new Map(Array.from(raw.matchAll(/\/(F\d+) (\d+) 0 R/g), (m) => [m[1], baseFonts.get(m[2] as string) ?? '?'] as [string, string]));

  const runs: TextRun[] = [];
  for (const content of pageContents(pdf)) {
    const stack: Array<{ mode: number; oblique: boolean; fill: string }> = [];
    let state = { mode: 0, oblique: false, fill: '0 0 0' };
    let font = '?';
    let y = 0;
    for (const line of content.split('\n')) {
      if (line === 'q') stack.push({ ...state });
      else if (line === 'Q') state = stack.pop() ?? { mode: 0, oblique: false, fill: '0 0 0' };
      else if (/ scn$/.test(line)) state.fill = line.slice(0, -4);
      else if (/^1 0 -?[\d.]+ 1 \S+ \S+ cm$/.test(line) && !/^1 0 0 1 /.test(line)) state.oblique = true;
      else if (/^\d Tr$/.test(line)) state.mode = Number(line[0]);
      else if (/ Tm$/.test(line)) y = Number(line.split(' ')[5]);
      else if (/^\/F\d+ \S+ Tf$/.test(line)) font = resources.get(line.split(' ')[0]?.slice(1) as string) ?? '?';
      else if (/T[Jj]$/.test(line)) {
        const text = Array.from(line.matchAll(/<([0-9a-f]*)>/g), (h) => Buffer.from(h[1] as string, 'hex').toString('latin1')).join('');
        runs.push({ font, mode: state.mode, oblique: state.oblique, fill: state.fill, text, y });
      }
    }
  }
  return runs;
}

/** Decompressed page content streams; PDFKit writes them as streams whose dictionary holds only Length and Filter. */
export function pageContents(pdf: Buffer): string[] {
  const raw = pdf.toString('latin1');
  return Array.from(raw.matchAll(/<<\s*\/Length \d+\s*\/Filter \/FlateDecode\s*>>\s*stream\r?\n/g), (m) => {
    const start = (m.index as number) + m[0].length;
    return inflateSync(pdf.subarray(start, raw.indexOf('endstream', start))).toString('latin1');
  });
}
