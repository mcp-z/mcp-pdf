import assert from 'assert';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { setupFonts, standardFonts } from '../../../src/lib/fonts.ts';
import { drawText, selectFace, type TextStyle } from '../../../src/lib/text-style.ts';
import type { FontConfig } from '../../../src/lib/types/typography.ts';
import { DEJAVU_SANS, pageContents, type TextRun, textRuns, writeDejaVuCollection } from '../../lib/fixture-fonts.ts';

const STYLES: TextStyle[] = [{}, { bold: true }, { italic: true }, { bold: true, italic: true }];

async function render(draw: (doc: PDFKit.PDFDocument) => Promise<void> | void): Promise<Buffer> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  await draw(doc);
  doc.end();
  return done;
}

async function runsForEachStyle(fontSpec: string | ((doc: PDFKit.PDFDocument) => FontConfig)): Promise<Array<Pick<TextRun, 'font' | 'mode' | 'oblique'>>> {
  const pdf = await render(async (doc) => {
    const fonts = typeof fontSpec === 'string' ? await setupFonts(doc, fontSpec) : fontSpec(doc);
    STYLES.forEach((style, i) => {
      drawText(doc, 'Styled text', { fonts, style, fontSize: 12, color: 'black' }, { x: 50, y: 50 + 20 * i });
    });
  });
  return textRuns(pdf).map(({ font, mode, oblique }) => ({ font, mode, oblique }));
}

describe('text-style', () => {
  const fixtureDir = join(process.cwd(), '.tmp', 'text-style-tests');
  let fullCollection: string;
  let boldOnlyCollection: string;

  before(() => {
    fullCollection = writeDejaVuCollection(fixtureDir);
    boldOnlyCollection = writeDejaVuCollection(fixtureDir, { faces: ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'], name: 'DejaVuSans-bold-only' });
  });
  after(() => safeRmSync(fixtureDir, { recursive: true, force: true }));

  describe('drawText', () => {
    it('fakes bold and italic for a font file with one style', async () => {
      assert.deepStrictEqual(await runsForEachStyle(DEJAVU_SANS), [
        { font: 'DejaVuSans', mode: 0, oblique: false },
        { font: 'DejaVuSans', mode: 2, oblique: false },
        { font: 'DejaVuSans', mode: 0, oblique: true },
        { font: 'DejaVuSans', mode: 2, oblique: true },
      ]);
    });

    it('uses the real faces of a collection', async () => {
      assert.deepStrictEqual(await runsForEachStyle(fullCollection), [
        { font: 'DejaVuSans', mode: 0, oblique: false },
        { font: 'DejaVuSans-Bold', mode: 0, oblique: false },
        { font: 'DejaVuSans-Oblique', mode: 0, oblique: false },
        { font: 'DejaVuSans-BoldOblique', mode: 0, oblique: false },
      ]);
    });

    it('uses real bold and fakes italic for a collection without italic faces', async () => {
      assert.deepStrictEqual(await runsForEachStyle(boldOnlyCollection), [
        { font: 'DejaVuSans', mode: 0, oblique: false },
        { font: 'DejaVuSans-Bold', mode: 0, oblique: false },
        { font: 'DejaVuSans', mode: 0, oblique: true },
        { font: 'DejaVuSans-Bold', mode: 0, oblique: true },
      ]);
    });

    it('uses the built-in faces of a standard font', async () => {
      assert.deepStrictEqual(await runsForEachStyle(() => standardFonts('Helvetica')), [
        { font: 'Helvetica', mode: 0, oblique: false },
        { font: 'Helvetica-Bold', mode: 0, oblique: false },
        { font: 'Helvetica-Oblique', mode: 0, oblique: false },
        { font: 'Helvetica-BoldOblique', mode: 0, oblique: false },
      ]);
    });

    it('strokes fake bold in the text color', async () => {
      const pdf = await render(async (doc) => {
        const fonts = await setupFonts(doc, DEJAVU_SANS);
        drawText(doc, 'Blue', { fonts, style: { bold: true }, fontSize: 12, color: '#0066cc' }, { x: 50, y: 50 });
      });
      const content = pageContents(pdf).join('\n');
      assert.match(content, /0 0\.4 0\.8 scn/, 'fill color');
      assert.match(content, /0 0\.4 0\.8 SCN/, 'stroke color');
    });
    it('keeps options when drawing at the current position', async () => {
      const pdf = await render((doc) => {
        drawText(doc, 'Underlined', { fonts: standardFonts('Helvetica'), style: {}, fontSize: 12, color: 'black' }, { underline: true });
      });
      assert.match(pageContents(pdf).join('\n'), / l\nS\n/, 'underline is stroked');
    });
  });

  describe('selectFace', () => {
    async function widths(fontSpec: string): Promise<{ regular: number; bold: number }> {
      let result = { regular: 0, bold: 0 };
      await render(async (doc) => {
        const fonts = await setupFonts(doc, fontSpec);
        doc.fontSize(12);
        selectFace(doc, fonts, {});
        const regular = doc.widthOfString('Measured words');
        selectFace(doc, fonts, { bold: true });
        result = { regular, bold: doc.widthOfString('Measured words') };
      });
      return result;
    }

    it('measures a real bold face with its own widths', async () => {
      const { regular, bold } = await widths(fullCollection);
      assert.ok(bold > regular, `bold ${bold} should be wider than regular ${regular}`);
    });

    it('measures fake bold with the regular widths', async () => {
      const { regular, bold } = await widths(DEJAVU_SANS);
      assert.strictEqual(bold, regular);
    });
  });
});
