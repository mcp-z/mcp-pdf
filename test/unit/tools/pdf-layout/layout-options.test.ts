import assert from 'assert';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { setupFonts } from '../../../../src/lib/fonts.ts';
import { renderText } from '../../../../src/lib/pdf-helpers.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'layout-tests');

describe('Layout Options for pdf-layout', () => {
  it('renders text with custom alignment', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'alignment-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fonts = await setupFonts(doc, undefined);
    const { regular: regularFont } = fonts;

    renderText(doc, 'Left aligned (default)', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Center aligned', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
      layout: { align: 'center' },
    });
    renderText(doc, 'Right aligned', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
      layout: { align: 'right' },
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    assert.ok(existsSync(outputPath), 'PDF with alignment should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  it('renders text with custom spacing (moveDown)', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'spacing-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fonts = await setupFonts(doc, undefined);
    const { regular: regularFont } = fonts;

    renderText(doc, 'Line 1', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });
    doc.moveDown(0.5);
    renderText(doc, 'Line 2 (0.5 spacing)', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });
    doc.moveDown(2);
    renderText(doc, 'Line 3 (2.0 spacing)', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    assert.ok(existsSync(outputPath), 'PDF with spacing should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  it('renders text with underline and strike', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'styling-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fonts = await setupFonts(doc, undefined);
    const { regular: regularFont } = fonts;

    renderText(doc, 'Normal text', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Underlined text', {
      typography: { fontSize: 12, fontName: regularFont, underline: true },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Strikethrough text', {
      typography: { fontSize: 12, fontName: regularFont, strike: true },
      features: { enableEmoji: false },
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    assert.ok(existsSync(outputPath), 'PDF with text styling should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  it('renders text with indentation', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'indent-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fonts = await setupFonts(doc, undefined);
    const { regular: regularFont } = fonts;

    renderText(doc, 'No indent', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Indent 20', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
      layout: { indent: 20 },
    });
    renderText(doc, 'Indent 40', {
      typography: { fontSize: 12, fontName: regularFont },
      features: { enableEmoji: false },
      layout: { indent: 40 },
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    assert.ok(existsSync(outputPath), 'PDF with indentation should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });
});

it('print test output directory', () => {
  console.log(`\n📁 Layout test PDFs generated in: ${testOutputDir}`);
  console.log('   Open these files to visually verify layout options\n');
});
