/**
 * Completeness proof for the local image dimension parsers
 * (src/lib/image-dimensions.ts).
 *
 * The parsers replaced the `image-size` dependency. This suite proves the
 * replacement is complete with respect to its contract:
 *
 *   PART 1 (agreement): whenever the installed PDFKit 0.20.2 reads a
 *   dimension header fully in range - i.e. it embeds a file with the file's
 *   true dimensions - the parser reports exactly the /Width /Height PDFKit
 *   writes to the actual generated PDF. Verified black-box: each corpus file
 *   (plus every byte-prefix truncation of the representative ones) is
 *   embedded with doc.image() and the XObject dictionary is read back from
 *   the PDF bytes. One deliberate divergence: a file truncated mid-header
 *   makes PDFKit's unbounded reads return out-of-range artifacts (0x0 or
 *   misaligned values) for a file that cannot render anyway; the parser
 *   returns null there so the tool asks for explicit dimensions instead.
 *   For files PDFKit rejects, the parser returns null too.
 *
 *   PART 2 (unit): the parser handles the structural edge cases of the
 *   PNG/JPEG formats (IHDR not first, duplicate IHDR, EXIF-prefixed JPEGs,
 *   null padding, standalone markers, degenerate dimensions, hostile chunk
 *   sizes) with the same accept/reject decisions as the PDFKit source.
 *
 *   PART 3 (fuzz): tens of thousands of random, truncated, and mutated
 *   buffers never throw, never hang (structurally bounded walks), and only
 *   return null or valid dimension values. This is the denial-of-service
 *   class of bug that the removed image-size dependency had (GHSA
 *   w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq - both unpatched upstream).
 */

import assert from 'assert';
import PDFDocument from 'pdfkit';
import { deflateSync } from 'zlib';
import { type ImageDimensions, parseImageDimensions } from '../../../src/lib/image-dimensions.ts';

// ---------------------------------------------------------------------------
// Deterministic PRNG (fixed seed - results are reproducible across runs)
// ---------------------------------------------------------------------------

let seed = 0x2f6e2b1;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function randInt(n: number): number {
  return Math.floor(rand() * n);
}
function randBytes(n: number): Buffer {
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    b[i] = randInt(256);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Synthetic image builders
// ---------------------------------------------------------------------------

const crcTable = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  out.write(type, 4, 'ascii');
  payload.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + payload.length)), 8 + payload.length);
  return out;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function ihdrPayload(w: number, h: number, bits: number, colorType: number): Buffer {
  const p = Buffer.alloc(13);
  p.writeUInt32BE(w, 0);
  p.writeUInt32BE(h, 4);
  p[8] = bits;
  p[9] = colorType;
  p[10] = 0; // compression
  p[11] = 0; // filter
  p[12] = 0; // interlace
  return p;
}

interface PngOptions {
  bits?: number;
  colorType?: number;
  preIhdrChunks?: Buffer[];
  /** Extra IHDR chunks appended after the first (a later IHDR overrides, as in png-js) */
  duplicateIhdrs?: Array<{ w: number; h: number }>;
}

function makePng(w: number, h: number, opts: PngOptions = {}): Buffer {
  const bits = opts.bits ?? 8;
  const colorType = opts.colorType ?? 2;
  // channels per pixel: 0=gray(1), 2=RGB(3), 3=indexed(1), 4=gray+alpha(2), 6=RGBA(4)
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  const rowBytes = bits < 8 ? Math.ceil((w * bits) / 8) : w * channels * (bits / 8);
  const raw = Buffer.alloc((rowBytes + 1) * h);
  let k = 0;
  for (let y = 0; y < h; y++) {
    raw[k++] = 0; // filter: None
    for (let x = 0; x < rowBytes; x++) {
      raw[k++] = (x * 7 + y * 13) & 0xff;
    }
  }
  const idat = deflateSync(raw);
  const chunks: Buffer[] = [];
  for (const c of opts.preIhdrChunks ?? []) {
    chunks.push(c);
  }
  chunks.push(pngChunk('IHDR', ihdrPayload(w, h, bits, colorType)));
  if (colorType === 3) {
    chunks.push(pngChunk('PLTE', Buffer.alloc(4 * 3)));
  }
  for (const d of opts.duplicateIhdrs ?? []) {
    chunks.push(pngChunk('IDAT', idat));
    chunks.push(pngChunk('IHDR', ihdrPayload(d.w, d.h, bits, colorType)));
  }
  chunks.push(pngChunk('IDAT', idat));
  chunks.push(pngChunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([PNG_SIG, ...chunks]);
}

function jpegSeg(marker: number, payload: Buffer): Buffer {
  const b = Buffer.alloc(4 + payload.length);
  b[0] = 0xff;
  b[1] = marker;
  b.writeUInt16BE(payload.length + 2, 2);
  payload.copy(b, 4);
  return b;
}

function sofSeg(marker: number, w: number, h: number, nf = 3): Buffer {
  const p = Buffer.alloc(1 + 2 + 2 + 1 + nf * 3);
  p[0] = 8; // bits per sample
  p.writeUInt16BE(h, 1);
  p.writeUInt16BE(w, 3);
  p[5] = nf;
  for (let i = 0; i < nf; i++) {
    p[6 + i * 3] = 1 + i; // component id
    p[7 + i * 3] = 0x11; // sampling
    p[8 + i * 3] = i % 2; // quantization table
  }
  return jpegSeg(marker, p);
}

function dqtSeg(): Buffer {
  const p = Buffer.alloc(65);
  p[0] = 0;
  for (let i = 1; i < 65; i++) {
    p[i] = (i * 17) & 0xff;
  }
  return jpegSeg(0xdb, p);
}

function dhtSeg(): Buffer {
  const p = Buffer.alloc(19);
  p[0] = 0; // DC
  p[1] = 0; // table 0
  p[2] = 1; // one 1-bit code
  p[18] = 0;
  return jpegSeg(0xc4, p);
}

function app0JfifSeg(): Buffer {
  return jpegSeg(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]));
}

function app1ExifSeg(): Buffer {
  const p = Buffer.alloc(20);
  p.write('Exif', 0, 'ascii');
  p[4] = 0;
  p[5] = 0;
  p[6] = 0x49;
  p[7] = 0x49; // 'II'
  p.writeUInt16LE(42, 8); // TIFF magic
  p.writeUInt32LE(8, 10); // IFD0 offset
  p.writeUInt16LE(0, 14); // 0 IFD entries
  p.writeUInt32LE(0, 16); // next IFD
  return jpegSeg(0xe1, p);
}

const TEM = Buffer.from([0xff, 0x01]);
const RST0 = Buffer.from([0xff, 0xd0]);
const EOI = Buffer.from([0xff, 0xd9]);

/** Assemble a JPEG: SOI + parts + SOS + a few scan bytes + EOI */
function makeJpeg(parts: Buffer[]): Buffer {
  const sos = jpegSeg(0xda, Buffer.from([1, 1, 1, 0x00, 0x00, 0x00]));
  const scan = Buffer.from([0x68, 0xc0, 0x20, 0x40]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), ...parts, sos, scan, EOI]);
}

// ---------------------------------------------------------------------------
// Black-box oracle: embed the buffer with the real installed PDFKit and read
// /Width /Height back from the generated PDF's XObject dictionary
// ---------------------------------------------------------------------------

type OracleResult = { ok: true; width: number; height: number } | { ok: false; error: string };

function pdfkitEmbeds(buf: Buffer): Promise<OracleResult> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    const chunks: Buffer[] = [];
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) });
    };
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('error', fail);
    doc.on('end', () => {
      if (settled) return;
      settled = true;
      const text = Buffer.concat(chunks).toString('latin1');
      const re = /\/Width (\d+)\s+\/Height (\d+)/g;
      const found: Array<[number, number]> = [];
      let m: RegExpExecArray | null = re.exec(text);
      while (m !== null) {
        found.push([Number(m[1]), Number(m[2])]);
        if (m.index === re.lastIndex) re.lastIndex++;
        m = re.exec(text);
      }
      if (found.length !== 1) {
        resolve({ ok: false, error: `expected exactly one /Width /Height XObject pair in the PDF, found ${found.length}` });
        return;
      }
      resolve({ ok: true, width: found[0][0], height: found[0][1] });
    });
    try {
      doc.image(buf, 0, 0);
      doc.end();
    } catch (error) {
      fail(error);
    }
  });
}

/** The agreement rule under test. */
function assertAgreement(name: string, buf: Buffer, oracle: OracleResult): ImageDimensions | null {
  const mine = parseImageDimensions(buf);
  if (oracle.ok) {
    assert.ok(mine, `${name}: PDFKit embedded the file (${oracle.width}x${oracle.height}) but the parser returned null`);
    assert.strictEqual(mine.width, oracle.width, `${name}: width mismatch (parser ${mine.width} vs PDF ${oracle.width})`);
    assert.strictEqual(mine.height, oracle.height, `${name}: height mismatch (parser ${mine.height} vs PDF ${oracle.height})`);
  }
  return mine;
}

// ---------------------------------------------------------------------------
// Corpus
// ---------------------------------------------------------------------------

interface CorpusEntry {
  name: string;
  buf: Buffer;
  /** expected dimensions, used to sanity-check the synthetic builders */
  dims?: ImageDimensions;
  /** files PDFKit must reject (hand-picked negatives) */
  rejected?: boolean;
}

const png8Gray1x1 = makePng(1, 1, { colorType: 0 });
const pngRgb32x16 = makePng(32, 16, { colorType: 2 });
const pngRgba10x10 = makePng(10, 10, { colorType: 6 });
const pngPalette4x8 = makePng(4, 8, { colorType: 3 });
const png1bitGray16x4 = makePng(16, 4, { bits: 1, colorType: 0 });
const png16bitRgb8x8 = makePng(8, 8, { bits: 16, colorType: 2 });
const pngTextBeforeIhdr = makePng(24, 12, { colorType: 2, preIhdrChunks: [pngChunk('tEXt', Buffer.from('Comment\x00hello'))] });
const pngDoubleIhdr = makePng(10, 10, { colorType: 2, duplicateIhdrs: [{ w: 21, h: 9 }] });
const pngBogusHugeChunk = Buffer.concat([
  PNG_SIG,
  pngChunk('IHDR', ihdrPayload(30, 20, 8, 2)),
  (() => {
    // a chunk claiming 0xFFFFFFFF bytes of payload - must not hang or walk backwards
    const c = Buffer.alloc(8);
    c.writeUInt32BE(0xffffffff, 0);
    c.write('AAAA', 4, 'ascii');
    return c;
  })(),
]);

const jpgJfif320x240 = makeJpeg([app0JfifSeg(), dqtSeg(), sofSeg(0xc0, 320, 240), dhtSeg()]);
const jpgExif4032x3024 = makeJpeg([app1ExifSeg(), dqtSeg(), sofSeg(0xc0, 4032, 3024), dhtSeg()]);
const jpgNullPadded100x50 = makeJpeg([Buffer.alloc(5), app0JfifSeg(), Buffer.alloc(3), dqtSeg(), sofSeg(0xc0, 100, 50), dhtSeg()]);
const jpgProgressive120x80 = makeJpeg([app0JfifSeg(), dqtSeg(), sofSeg(0xc2, 120, 80), dhtSeg()]);
const jpgSofC8_64x48 = makeJpeg([dqtSeg(), sofSeg(0xc8, 64, 48), dhtSeg()]);
const jpgSofCc_33x77 = makeJpeg([dqtSeg(), sofSeg(0xcc, 33, 77), dhtSeg()]);
const jpgComment90x60 = makeJpeg([jpegSeg(0xfe, Buffer.from('comment')), dqtSeg(), dhtSeg(), sofSeg(0xc0, 90, 60)]);
const jpgTemThenSof = makeJpeg([TEM, Buffer.from([0x00, 0x05]), Buffer.alloc(5), sofSeg(0xc0, 44, 22)]);
const jpgRst0ThenSof = makeJpeg([RST0, Buffer.from([0x00, 0x03]), Buffer.alloc(3), sofSeg(0xc0, 15, 30)]);
const jpgZeroDims = makeJpeg([dqtSeg(), sofSeg(0xc0, 0, 0), dhtSeg()]);

const negGif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(8)]);
const negWebp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const negBmp = Buffer.concat([Buffer.from('BM'), Buffer.alloc(30)]);
const negTiff = (() => {
  const b = Buffer.alloc(44);
  b.write('II', 0, 'ascii');
  b.writeUInt16LE(42, 2);
  return b;
})();
const negIco = Buffer.concat([Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]), Buffer.alloc(16)]);
const negIcns = Buffer.concat([Buffer.from('icns'), Buffer.alloc(32)]);
const negJp2 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]), Buffer.alloc(16)]);
const negHeic = Buffer.concat([Buffer.from('ftyp'), Buffer.from('heic'), Buffer.alloc(16)]);
const negAvif = Buffer.concat([Buffer.from('ftyp'), Buffer.from('avif'), Buffer.alloc(16)]);
const negGarbage = randBytes(64);
const negEmpty = Buffer.alloc(0);
const negOneByte = Buffer.from([0x42]);
const negJpegGateOnly = Buffer.from([0xff, 0xd8]);
const negPngGateOnly = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const negText = Buffer.from('hello world - this is not an image');
const negJpegGateNulls = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(100)]);
const negPngGateNulls = Buffer.concat([PNG_SIG, Buffer.alloc(40)]);

// ---------------------------------------------------------------------------
// PART 1 - agreement with the black-box PDFKit oracle
// ---------------------------------------------------------------------------

describe('image-dimensions: agreement with PDFKit 0.20.2 (black box)', () => {
  const positiveCorpus: CorpusEntry[] = [
    { name: 'png 8-bit gray 1x1', buf: png8Gray1x1, dims: { width: 1, height: 1 } },
    { name: 'png RGB 32x16', buf: pngRgb32x16, dims: { width: 32, height: 16 } },
    { name: 'png RGBA 10x10', buf: pngRgba10x10, dims: { width: 10, height: 10 } },
    { name: 'png palette 4x8', buf: pngPalette4x8, dims: { width: 4, height: 8 } },
    { name: 'png 1-bit gray 16x4', buf: png1bitGray16x4, dims: { width: 16, height: 4 } },
    { name: 'png 16-bit RGB 8x8', buf: png16bitRgb8x8, dims: { width: 8, height: 8 } },
    { name: 'png tEXt before IHDR 24x12', buf: pngTextBeforeIhdr, dims: { width: 24, height: 12 } },
    { name: 'png duplicate IHDR (last wins) 21x9', buf: pngDoubleIhdr, dims: { width: 21, height: 9 } },
    { name: 'jpeg JFIF 320x240', buf: jpgJfif320x240, dims: { width: 320, height: 240 } },
    { name: 'jpeg EXIF-prefixed 4032x3024', buf: jpgExif4032x3024, dims: { width: 4032, height: 3024 } },
    { name: 'jpeg null-padded 100x50', buf: jpgNullPadded100x50, dims: { width: 100, height: 50 } },
    { name: 'jpeg progressive SOF2 120x80', buf: jpgProgressive120x80, dims: { width: 120, height: 80 } },
    { name: 'jpeg SOF C8 (JPG) 64x48', buf: jpgSofC8_64x48, dims: { width: 64, height: 48 } },
    { name: 'jpeg SOF CC (DAC) 33x77', buf: jpgSofCc_33x77, dims: { width: 33, height: 77 } },
    { name: 'jpeg COM+DHT 90x60', buf: jpgComment90x60, dims: { width: 90, height: 60 } },
    { name: 'jpeg TEM before SOF 44x22', buf: jpgTemThenSof, dims: { width: 44, height: 22 } },
    { name: 'jpeg RST0 before SOF 15x30', buf: jpgRst0ThenSof, dims: { width: 15, height: 30 } },
    { name: 'jpeg degenerate 0x0', buf: jpgZeroDims, dims: { width: 0, height: 0 } },
  ];

  const negativeCorpus: CorpusEntry[] = [
    { name: 'gif', buf: negGif, rejected: true },
    { name: 'webp', buf: negWebp, rejected: true },
    { name: 'bmp', buf: negBmp, rejected: true },
    { name: 'tiff', buf: negTiff, rejected: true },
    { name: 'ico', buf: negIco, rejected: true },
    { name: 'icns', buf: negIcns, rejected: true },
    { name: 'jp2', buf: negJp2, rejected: true },
    { name: 'heic', buf: negHeic, rejected: true },
    { name: 'avif', buf: negAvif, rejected: true },
    { name: 'random garbage', buf: negGarbage, rejected: true },
    { name: 'empty file', buf: negEmpty, rejected: true },
    { name: 'one byte', buf: negOneByte, rejected: true },
    { name: 'FF D8 only', buf: negJpegGateOnly, rejected: true },
    { name: 'PNG signature only', buf: negPngGateOnly, rejected: true },
    { name: 'plain text', buf: negText, rejected: true },
    { name: 'JPEG gate + 100 nulls', buf: negJpegGateNulls, rejected: true },
    { name: 'PNG gate + 40 nulls', buf: negPngGateNulls, rejected: true },
  ];

  it('returns the exact dimensions PDFKit writes to the PDF for every embeddable corpus file', async () => {
    for (const entry of positiveCorpus) {
      const oracle = await pdfkitEmbeds(entry.buf);
      assert.ok(oracle.ok, `${entry.name}: PDFKit rejected the file unexpectedly: ${oracle.ok ? '' : oracle.error}`);
      // sanity-check the synthetic builder, then the agreement rule
      const mine = assertAgreement(entry.name, entry.buf, oracle);
      assert.deepStrictEqual(mine, entry.dims, `${entry.name}: builder sanity check failed`);
    }
  });

  it('matches PDFKit on every byte-prefix truncation of representative files', async () => {
    const sweepFiles = [
      { name: 'jpeg JFIF 320x240', buf: jpgJfif320x240, w: 320, h: 240 },
      { name: 'jpeg EXIF 4032x3024', buf: jpgExif4032x3024, w: 4032, h: 3024 },
      { name: 'png RGB 32x16', buf: pngRgb32x16, w: 32, h: 16 },
      { name: 'png RGBA 10x10', buf: pngRgba10x10, w: 10, h: 10 },
    ];
    let acceptedTrue = 0;
    let acceptedArtifact = 0;
    let rejected = 0;
    let rejectedButParserSaidDims = 0;
    for (const file of sweepFiles) {
      for (let len = 0; len <= file.buf.length; len++) {
        const prefix = file.buf.subarray(0, len);
        const oracle = await pdfkitEmbeds(prefix);
        const mine = parseImageDimensions(prefix);
        const label = `${file.name} truncated to ${len} bytes`;
        if (oracle.ok) {
          if (oracle.width === file.w && oracle.height === file.h) {
            // PDFKit read the dimension header fully in range, so its values
            // are the file's true dimensions: the parser must agree exactly.
            acceptedTrue++;
            assert.ok(mine, `${label}: parser returned null but PDFKit embedded with true dims ${file.w}x${file.h}`);
            assert.strictEqual(mine.width, oracle.width, `${label}: width mismatch (parser ${mine.width} vs PDF ${oracle.width})`);
            assert.strictEqual(mine.height, oracle.height, `${label}: height mismatch (parser ${mine.height} vs PDF ${oracle.height})`);
          } else {
            // The prefix ends mid-dimension-header: PDFKit's values are an
            // artifact of its unbounded reads (missing bytes read as 0 or
            // misaligned - e.g. a JPEG cut after the SOF marker "embeds" as
            // 0x0, or mid-SOF as misaligned garbage). The parser must refuse
            // such files rather than mirror the artifact.
            acceptedArtifact++;
            assert.strictEqual(mine, null, `${label}: parser mirrored PDFKit's out-of-range artifact ${oracle.width}x${oracle.height}`);
          }
        } else {
          rejected++;
          // A file PDFKit cannot embed must not be reported as having usable
          // dimensions (the layout engine would promise a render that cannot
          // happen). The parser returns null for all such truncations.
          if (mine) rejectedButParserSaidDims++;
        }
      }
    }
    assert.ok(acceptedTrue > 0, 'sweep sanity: no truncation carried the true dimensions');
    assert.ok(acceptedArtifact > 0, 'sweep sanity: expected mid-header truncations where PDFKit reads out of range');
    assert.ok(rejected > 0, 'sweep sanity: no truncation was rejected by PDFKit');
    assert.strictEqual(rejectedButParserSaidDims, 0, 'parser reported dimensions for a file PDFKit cannot embed');
  });

  it('rejects every unsupported format PDFKit rejects, returning null', async () => {
    for (const entry of negativeCorpus) {
      const oracle = await pdfkitEmbeds(entry.buf);
      assert.ok(!oracle.ok, `${entry.name}: PDFKit unexpectedly embedded the file`);
      const mine = parseImageDimensions(entry.buf);
      assert.strictEqual(mine, null, `${entry.name}: parser should return null, got ${JSON.stringify(mine)}`);
    }
  });

  it('rejects a real PDF buffer (a non-image that PDFKit cannot embed)', async () => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve());
      doc.on('error', reject);
      doc.text('not an image');
      doc.end();
    });
    const pdfBuf = Buffer.concat(chunks);
    const oracle = await pdfkitEmbeds(pdfBuf);
    assert.ok(!oracle.ok, 'PDFKit should reject a PDF as an image');
    assert.strictEqual(parseImageDimensions(pdfBuf), null);
  });
});

// ---------------------------------------------------------------------------
// PART 2 - parser unit behavior on structural edge cases
// ---------------------------------------------------------------------------

describe('image-dimensions: parser unit behavior', () => {
  it('returns null for buffers shorter than any gate', () => {
    assert.strictEqual(parseImageDimensions(Buffer.alloc(0)), null);
    assert.strictEqual(parseImageDimensions(Buffer.from([0xff])), null);
    assert.strictEqual(parseImageDimensions(Buffer.from([0x89, 0x50])), null);
  });

  it('returns null for an unsupported leading byte pair', () => {
    assert.strictEqual(parseImageDimensions(Buffer.from([0x00, 0x00, 0x00, 0x00])), null);
  });

  it('does not hang on a chunk claiming 4 GiB (PNG)', () => {
    assert.strictEqual(parseImageDimensions(pngBogusHugeChunk), null);
  });

  it('does not hang on a JPEG of zero-length segment loops', () => {
    const parts: Buffer[] = [];
    for (let i = 0; i < 1000; i++) {
      parts.push(Buffer.from([0xff, 0x00, 0x00, 0x00]));
    }
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8]), ...parts]);
    assert.strictEqual(parseImageDimensions(buf), null);
  });

  it('returns null for a JPEG whose SOF payload is truncated', () => {
    // SOF0: [FF C0][len:2][bits][height:2][width:2] - cut before the width's
    // second byte; the parser must not read past the end
    const sof = sofSeg(0xc0, 100, 100);
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8]), sof.subarray(0, 8)]);
    assert.strictEqual(parseImageDimensions(buf), null);
  });

  it('returns dimensions for a SOF variant marker set identical to PDFKit (C0-CF except C4)', () => {
    for (const marker of [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf]) {
      const buf = makeJpeg([sofSeg(marker, 55, 77)]);
      assert.deepStrictEqual(parseImageDimensions(buf), { width: 55, height: 77 }, `SOF marker 0xff${marker.toString(16)}`);
    }
    // C4 (DHT) must NOT be treated as an SOF - the walk continues past it
    const dhtOnly = makeJpeg([dhtSeg()]);
    assert.strictEqual(parseImageDimensions(dhtOnly), null);
  });

  it('respects explicit width/height filtering at the file level', () => {
    // a file whose SOF declares 0x0 has "dimensions" but they are unusable;
    // the parser reports them (matching PDFKit), callers filter via
    // dimensions.width && dimensions.height
    assert.deepStrictEqual(parseImageDimensions(jpgZeroDims), { width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// PART 3 - fuzz: never throws, never hangs, only null or valid dimensions
// ---------------------------------------------------------------------------

describe('image-dimensions: fuzz (no throw, no hang, valid values)', function () {
  this.timeout(120000);

  function assertValid(name: string, buf: Buffer): ImageDimensions | null {
    let result: ImageDimensions | null = null;
    try {
      result = parseImageDimensions(buf);
    } catch (error) {
      assert.fail(`${name}: parser threw: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (result) {
      assert.ok(Number.isInteger(result.width) && result.width >= 0 && result.width < 2 ** 32, `${name}: invalid width ${result.width}`);
      assert.ok(Number.isInteger(result.height) && result.height >= 0 && result.height < 2 ** 32, `${name}: invalid height ${result.height}`);
    }
    return result;
  }

  it('survives 20000 random tiny buffers and 3000 random medium buffers', () => {
    const start = Date.now();
    for (let i = 0; i < 20000; i++) {
      assertValid(`random tiny #${i}`, randBytes(randInt(65)));
    }
    for (let i = 0; i < 3000; i++) {
      assertValid(`random medium #${i}`, randBytes(randInt(4097)));
    }
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 90000, `fuzz took ${elapsed}ms - possible hang`);
  });

  it('survives single/multi-byte mutations of every corpus file', () => {
    const allCorpus = [
      png8Gray1x1,
      pngRgb32x16,
      pngRgba10x10,
      pngPalette4x8,
      png1bitGray16x4,
      png16bitRgb8x8,
      pngTextBeforeIhdr,
      pngDoubleIhdr,
      jpgJfif320x240,
      jpgExif4032x3024,
      jpgNullPadded100x50,
      jpgProgressive120x80,
      jpgSofC8_64x48,
      jpgSofCc_33x77,
      jpgComment90x60,
      jpgTemThenSof,
      jpgRst0ThenSof,
      jpgZeroDims,
      negGif,
      negWebp,
      negIcns,
      negJp2,
    ];
    for (const base of allCorpus) {
      for (let i = 0; i < 15; i++) {
        const buf = Buffer.from(base);
        const flips = 1 + randInt(3);
        for (let f = 0; f < flips; f++) {
          const off = randInt(buf.length);
          buf[off] ^= 1 << randInt(8);
        }
        assertValid(`mutation of ${base.length}-byte corpus file #${i}`, buf);
      }
    }
  });

  it('survives gate-biased fuzz (forced JPEG/PNG prefixes + random tail)', () => {
    const gates = [Buffer.from([0xff, 0xd8]), Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from([0x89, 0x50]), Buffer.from([0xff, 0xff]), Buffer.from([0x00, 0xff])];
    for (let i = 0; i < 5000; i++) {
      const buf = Buffer.concat([gates[randInt(gates.length)], randBytes(randInt(257))]);
      assertValid(`gate-biased #${i}`, buf);
    }
  });

  it('terminates on worst-case padding/leader patterns', () => {
    // all-null tail after the JPEG gate (skipped by the padding loop)
    assertValid('jpeg gate + 10000 nulls', Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(10000)]));
    // alternating FF 00 pairs (each a bogus 0xff00 marker with zero length)
    const alt = Buffer.alloc(10000);
    for (let i = 0; i < alt.length; i += 2) {
      alt[i] = 0xff;
    }
    assertValid('jpeg gate + FF 00 pairs', Buffer.concat([Buffer.from([0xff, 0xd8]), alt]));
    // PNG gate + zero-sized zero-typed chunks forever
    const zeros = Buffer.alloc(10000);
    assertValid('png gate + zeros', Buffer.concat([PNG_SIG, zeros]));
  });
});
