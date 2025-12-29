import assert from 'assert';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { setupFonts } from '../../../../src/lib/fonts.js';
import { renderTextWithEmoji } from '../../../../src/lib/pdf-helpers.js';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'layout-tests');

describe('Layout Options for pdf-layout', () => {
  it('renders text with custom alignment', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'alignment-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fonts = await setupFonts(doc);
    const { regular: regularFont } = fonts;

    renderTextWithEmoji(doc, 'Left aligned (default)', 12, regularFont, false);
    renderTextWithEmoji(doc, 'Center aligned', 12, regularFont, false, { align: 'center' });
    renderTextWithEmoji(doc, 'Right aligned', 12, regularFont, false, { align: 'right' });

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

    const fonts = await setupFonts(doc);
    const { regular: regularFont } = fonts;

    renderTextWithEmoji(doc, 'Line 1', 12, regularFont, false);
    doc.moveDown(0.5);
    renderTextWithEmoji(doc, 'Line 2 (0.5 spacing)', 12, regularFont, false);
    doc.moveDown(2);
    renderTextWithEmoji(doc, 'Line 3 (2.0 spacing)', 12, regularFont, false);

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

    const fonts = await setupFonts(doc);
    const { regular: regularFont } = fonts;

    renderTextWithEmoji(doc, 'Normal text', 12, regularFont, false);
    renderTextWithEmoji(doc, 'Underlined text', 12, regularFont, false, { underline: true });
    renderTextWithEmoji(doc, 'Strikethrough text', 12, regularFont, false, { strike: true });

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

    const fonts = await setupFonts(doc);
    const { regular: regularFont } = fonts;

    renderTextWithEmoji(doc, 'No indent', 12, regularFont, false);
    renderTextWithEmoji(doc, 'Indent 20', 12, regularFont, false, { indent: 20 });
    renderTextWithEmoji(doc, 'Indent 40', 12, regularFont, false, { indent: 40 });

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
