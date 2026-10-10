import { fonts } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../../../src/lib/emoji-renderer.ts';
import { measureMarkdownTextHeight, type PDFTextOptions, renderText, type TextRenderConfig } from '../../../src/lib/pdf-helpers.ts';
import { pageContents, type TextRun, textRuns } from '../../lib/fixture-fonts.ts';

type ContentItem =
  | { type: 'text'; text: string; fontSize?: number; bold?: boolean; color?: string; left?: number; top?: number; width?: number; align?: string; oblique?: number | boolean; characterSpacing?: number; moveDown?: number }
  | { type: 'heading'; text: string; fontSize?: number; bold?: boolean; color?: string; left?: number; top?: number; width?: number; align?: string; oblique?: number | boolean; characterSpacing?: number; moveDown?: number }
  | { type: 'rect'; left: number; top: number; width: number; height: number; fillColor?: string; strokeColor?: string; lineWidth?: number }
  | { type: 'circle'; left: number; top: number; radius: number; fillColor?: string; strokeColor?: string; lineWidth?: number }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; strokeColor?: string; lineWidth?: number }
  | { type: 'pageBreak' };

/**
 * Helper function that simulates the enhanced pdf-create tool
 * This is what an agent would call with calculated values
 */
async function createPdfWithEnhancements(options: {
  pageSetup?: {
    size?: [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
    backgroundColor?: string;
  };
  content: ContentItem[];
}): Promise<Buffer> {
  const { pageSetup, content } = options;

  // Create PDF document with optional page setup
  interface PDFDocOptions {
    size?: [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
  }

  const docOptions: PDFDocOptions = {};
  if (pageSetup?.size) docOptions.size = pageSetup.size;
  if (pageSetup?.margins) docOptions.margins = pageSetup.margins;

  const doc = new PDFDocument(docOptions);

  // Capture PDF in memory
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Draw background if specified
  if (pageSetup?.backgroundColor) {
    const pageSize = pageSetup?.size || [612, 792];
    doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
  }

  // Check if content has emoji
  const contentText = JSON.stringify(content);
  const containsEmoji = fonts.hasEmoji(contentText);
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  // Setup fonts
  const fontSet = await fonts.setupFonts(doc, undefined);

  // Helper to draw background on new pages
  const drawBackgroundOnPage = () => {
    if (pageSetup?.backgroundColor) {
      const currentY = doc.y;
      const currentX = doc.x;
      const pageSize = pageSetup?.size || [612, 792];
      doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
      doc.x = currentX;
      doc.y = currentY;
    }
  };

  doc.on('pageAdded', drawBackgroundOnPage);

  // Process content
  for (const item of content) {
    switch (item.type) {
      case 'text':
      case 'heading': {
        const fontSize = item.fontSize ?? (item.type === 'text' ? 12 : 24);
        const bold = item.type === 'heading' ? item.bold !== false : item.bold === true;

        const options: PDFTextOptions = {};
        if (item.left !== undefined) options.x = item.left;
        if (item.top !== undefined) options.y = item.top;
        if (item.align !== undefined) options.align = item.align as 'left' | 'center' | 'right' | 'justify';
        if (item.width !== undefined) options.width = item.width;
        if (item.oblique !== undefined) options.oblique = item.oblique;
        if (item.characterSpacing !== undefined) options.characterSpacing = item.characterSpacing;

        renderText(doc, item.text, {
          typography: { fontSize, fonts: fontSet, style: { bold } },
          color: { fillColor: item.color },
          features: { enableEmoji: emojiAvailable },
          layout: options,
        });
        if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
        break;
      }

      case 'rect': {
        doc.rect(item.left, item.top, item.width, item.height);
        if (item.fillColor && item.strokeColor) {
          doc.fillAndStroke(item.fillColor, item.strokeColor);
        } else if (item.fillColor) {
          doc.fill(item.fillColor);
        } else if (item.strokeColor) {
          if (item.lineWidth) doc.lineWidth(item.lineWidth);
          doc.stroke(item.strokeColor);
        }
        break;
      }

      case 'circle': {
        doc.circle(item.left, item.top, item.radius);
        if (item.fillColor && item.strokeColor) {
          doc.fillAndStroke(item.fillColor, item.strokeColor);
        } else if (item.fillColor) {
          doc.fill(item.fillColor);
        } else if (item.strokeColor) {
          if (item.lineWidth) doc.lineWidth(item.lineWidth);
          doc.stroke(item.strokeColor);
        }
        break;
      }

      case 'line': {
        if (item.lineWidth) doc.lineWidth(item.lineWidth);
        doc
          .moveTo(item.x1, item.y1)
          .lineTo(item.x2, item.y2)
          .stroke(item.strokeColor || 'black');
        break;
      }

      case 'pageBreak': {
        doc.addPage();
        break;
      }
    }
  }

  doc.end();

  return await pdfPromise;
}
describe('Enhanced API - Optional Parameters', () => {
  it('basic content works without enhanced features', async () => {
    // Basic content - no pageSetup, no colors, no shapes
    const pdfBuffer = await createPdfWithEnhancements({
      content: [
        { type: 'heading', text: 'Business Letter' },
        { type: 'text', text: 'This is a simple letter.', moveDown: 1 },
        { type: 'text', text: 'With multiple paragraphs.', moveDown: 0.5 },
        { type: 'text', text: 'No enhanced features used.' },
      ],
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    assert.ok(pdfBuffer.toString('utf8', 0, 4) === '%PDF', 'Should be a valid PDF');
    console.log(`    ✅ Optional parameters work: (${pdfBuffer.length} bytes)`);
  });
});

describe('Enhanced API - New Features', () => {
  it('pageSetup: custom background color', async () => {
    const pdfBuffer = await createPdfWithEnhancements({
      pageSetup: {
        backgroundColor: '#1a1a1a', // Dark gray
      },
      content: [
        { type: 'heading', text: 'Dark Theme Document', color: 'white', align: 'center' },
        { type: 'text', text: 'Text on dark background', color: '#cccccc', align: 'center' },
      ],
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('pageSetup: custom margins and size', async () => {
    const pdfBuffer = await createPdfWithEnhancements({
      pageSetup: {
        size: [612, 792],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      content: [{ type: 'text', text: 'Full bleed document with zero margins', left: 50, top: 50 }],
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('text colors', async () => {
    const pdfBuffer = await createPdfWithEnhancements({
      content: [
        { type: 'heading', text: 'Colorful Document', color: '#FF6B6B' },
        { type: 'text', text: 'Red text', color: '#FF0000', moveDown: 0.5 },
        { type: 'text', text: 'Blue text', color: '#0000FF', moveDown: 0.5 },
        { type: 'text', text: 'Green text', color: '#00FF00', moveDown: 0.5 },
        { type: 'text', text: 'Gold text', color: '#FFD700' },
      ],
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('shapes: rectangles, circles, lines', async () => {
    const pdfBuffer = await createPdfWithEnhancements({
      content: [
        // Rectangle header
        { type: 'rect', left: 0, top: 0, width: 612, height: 80, fillColor: '#4A90E2' },
        { type: 'heading', text: 'Shapes Demo', color: 'white', align: 'center', top: 30 },

        // Horizontal line
        { type: 'line', x1: 72, y1: 100, x2: 540, y2: 100, strokeColor: '#4A90E2', lineWidth: 2 },

        // Circles
        { type: 'circle', left: 150, top: 200, radius: 30, fillColor: '#FF6B6B' },
        { type: 'circle', left: 300, top: 200, radius: 30, fillColor: '#4ECDC4' },
        { type: 'circle', left: 450, top: 200, radius: 30, fillColor: '#FFD93D' },

        // Rectangle with border
        { type: 'rect', left: 100, top: 300, width: 200, height: 100, fillColor: '#F0F0F0', strokeColor: '#333333', lineWidth: 3 },
      ],
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});

describe('Enhanced API - Agent Workflow Simulation', () => {
  it('agent calculates progressive font sizes', async () => {
    // Simulate agent calculating progressive font sizes
    const lines = ['This line starts small', 'This line is slightly bigger', 'This line is medium', 'This line is getting large', 'This line is very large'];

    const content: ContentItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const progress = i / (lines.length - 1); // 0.0 to 1.0
      const fontSize = 8 + progress * 16; // 8pt → 24pt

      content.push({
        type: 'text',
        text: line,
        fontSize,
        align: 'center',
        moveDown: 0.5,
      });
    }

    const pdfBuffer = await createPdfWithEnhancements({ content });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📊 Agent calculated ${lines.length} progressive font sizes`);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('agent calculates centered tapering widths', async () => {
    const lines = ['Narrow', 'Getting Wider', 'Even Wider Now', 'Maximum Width Here', 'Full Text Width'];

    const pageWidth = 612;
    const content: ContentItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const progress = i / (lines.length - 1);
      const width = 150 + progress * 300; // 150px → 450px
      const x = (pageWidth - width) / 2; // Center it

      content.push({
        type: 'text',
        text: line,
        width,
        left: x,
        align: 'center',
        fontSize: 14,
        moveDown: 0.5,
      });
    }

    const pdfBuffer = await createPdfWithEnhancements({ content });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📊 Agent calculated ${lines.length} centered tapered widths`);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});

describe('Enhanced API - Space Journey Resume (Sci-Fi Style)', () => {
  it('generates space journey resume with tapering', async () => {
    // Agent generates a Space Journey style resume with sci-fi theme
    // Uses purple/cyan color scheme with dramatic tapering effect

    const resumeLines = [
      'IN THE VASTNESS OF SPACE AND TIME...',
      '',
      'THE ODYSSEY OF ALEX QUANTUM',
      'Chapter I: The Engineer Awakens',
      '',
      'Born on Earth Station Alpha, our hero discovered a talent',
      'for uniting scattered teams across the cosmos. Through',
      'technical mastery and diplomatic wisdom, Alex transformed',
      'chaos into order, bringing light to the darkest reaches',
      'of the galaxy through code and collaboration.',
      '',
      'THE JOURNEY BEGINS',
      '',
      'Stellar Systems Inc. (2020-2025)',
      'Chief Technology Architect',
      '',
      'Led the great Migration - moving 500+ code repositories',
      'from ancient servers to quantum cloud infrastructure.',
      'United warring development factions under a single',
      'platform, increasing velocity tenfold across all',
      'systems and territories throughout known space.',
      '',
      'Cosmic Ventures (2018-2020)',
      'Senior Systems Engineer',
      '',
      'Architected real-time communication systems spanning',
      'multiple star systems. Implemented AI-driven automation',
      'that reduced manual operations by 70%, allowing teams',
      'to focus on exploration rather than maintenance.',
      '',
      'TRAINING AT THE ACADEMY',
      '',
      'Galactic Institute of Technology - Masters Degree',
      'Specialization: Distributed Systems Architecture',
      '',
      'Earth Technical College - Bachelor of Engineering',
      'Focus: Quantum Computing and Neural Networks',
      '',
      'THE PROPHECY',
      '',
      '"There is one who brings order from chaos,"',
      '"Who unites the scattered and modernizes the ancient,"',
      '"Whose journey began on a distant station,"',
      '"And whose impact spans the entire galaxy."',
      '',
      'The journey continues among the stars...',
      '',
      '- End Transmission -',
    ];

    const pageWidth = 612;
    const content: ContentItem[] = [];

    // First, add the space opening line
    const firstLine = resumeLines[0];
    if (firstLine) {
      content.push({
        type: 'text',
        text: firstLine,
        fontSize: 11,
        color: '#00D9FF', // Cyan
        align: 'center',
        moveDown: 1.5,
      });
    }

    // Calculate tapering for the rest
    const mainContent = resumeLines.slice(1);

    for (let i = 0; i < mainContent.length; i++) {
      const line = mainContent[i];
      if (!line) continue;

      if (line === '') {
        content.push({ type: 'text', text: '', fontSize: 1, moveDown: 0.3 });
        continue;
      }

      const progress = i / mainContent.length; // 0.0 to 1.0

      // Dramatic tapering
      const fontSize = 7 + progress * 13; // 7pt → 20pt
      const width = 250 + progress * 250; // 250px → 500px
      const x = (pageWidth - width) / 2; // Center

      // Headings (all caps or "Chapter")
      const isHeading = line === line.toUpperCase() || line.startsWith('Chapter');

      content.push({
        type: isHeading ? 'heading' : 'text',
        text: line,
        fontSize: isHeading ? Math.max(fontSize, 12) : fontSize,
        bold: isHeading,
        color: '#B794F6', // Purple
        width,
        left: x,
        align: 'center',
        oblique: 15, // Italic slant for perspective
        characterSpacing: 0.3,
        moveDown: isHeading ? 0.4 : 0.2,
      });
    }

    const pdfBuffer = await createPdfWithEnhancements({
      pageSetup: {
        backgroundColor: '#0A0A1F', // Deep space purple-black instead of pure black
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
      },
      content,
    });

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');

    // Validation: Check file size is reasonable (using Helvetica = smaller, custom fonts = larger)
    assert.ok(pdfBuffer.length > 3000 && pdfBuffer.length < 40000, `PDF size should be reasonable (got ${pdfBuffer.length} bytes)`);

    console.log(`    🌟 Space Journey Resume created: (${pdfBuffer.length} bytes)`);
    console.log(`    📊 Agent calculated ${mainContent.length} progressive values`);
    console.log('    ✨ Features: tapering font (7→20pt), tapering width (250→500px), centered, oblique');
    console.log('    🎨 Color scheme: Purple/Cyan on deep space background');
  });
});
// Use .tmp/ in package root, never os.tmpdir() (testing-standards)
const testOutputDir = join(process.cwd(), '.tmp', 'layout-tests');
describe('Layout Options for pdf-layout', () => {
  it('renders text with custom alignment', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'alignment-test.pdf');

    const doc = new PDFDocument();
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    const fontSet = await fonts.setupFonts(doc, undefined);

    renderText(doc, 'Left aligned (default)', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Center aligned', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
      layout: { align: 'center' },
    });
    renderText(doc, 'Right aligned', {
      typography: { fontSize: 12, fonts: fontSet },
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

    const fontSet = await fonts.setupFonts(doc, undefined);

    renderText(doc, 'Line 1', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
    });
    doc.moveDown(0.5);
    renderText(doc, 'Line 2 (0.5 spacing)', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
    });
    doc.moveDown(2);
    renderText(doc, 'Line 3 (2.0 spacing)', {
      typography: { fontSize: 12, fonts: fontSet },
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

    const fontSet = await fonts.setupFonts(doc, undefined);

    renderText(doc, 'Normal text', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Underlined text', {
      typography: { fontSize: 12, fonts: fontSet, underline: true },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Strikethrough text', {
      typography: { fontSize: 12, fonts: fontSet, strike: true },
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

    const fontSet = await fonts.setupFonts(doc, undefined);

    renderText(doc, 'No indent', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
    });
    renderText(doc, 'Indent 20', {
      typography: { fontSize: 12, fonts: fontSet },
      features: { enableEmoji: false },
      layout: { indent: 20 },
    });
    renderText(doc, 'Indent 40', {
      typography: { fontSize: 12, fonts: fontSet },
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

describe('measureMarkdownTextHeight style lookup', () => {
  const fontSize = 12;
  const lineGap = 0;
  const helvetica = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' };
  const lineHeight = new PDFDocument().font('Helvetica').fontSize(fontSize).currentLineHeight(true);

  // Width of the plain words, each measured in the given font; whitespace tokens use the regular font.
  function widthOf(doc: PDFKit.PDFDocument, words: Array<[string, string]>): number {
    return words.reduce((sum, [word, font]) => sum + doc.font(font).fontSize(fontSize).widthOfString(word), 0);
  }

  it('applies a bold range that comes after many other ranges', () => {
    const doc = new PDFDocument();
    const r = helvetica.regular;
    const fitsOnlyIfRegular =
      widthOf(doc, [
        ['a', r],
        [' ', r],
        ['b', helvetica.italic],
        [' ', r],
        ['c', r],
        [' ', r],
        ['d', helvetica.italic],
        [' ', r],
        ['wider', r],
      ]) + 0.01;
    const height = measureMarkdownTextHeight(doc, 'a *b* c *d* **wider**', fitsOnlyIfRegular, fontSize, lineGap, helvetica);
    assert.strictEqual(height, 2 * lineHeight, 'bold "wider" is wider than regular, so it wraps');
  });

  it('applies a bold range at the start', () => {
    const doc = new PDFDocument();
    const r = helvetica.regular;
    const fitsOnlyIfRegular =
      widthOf(doc, [
        ['wider', r],
        [' ', r],
        ['a', helvetica.italic],
        [' ', r],
        ['c', r],
      ]) + 0.01;
    const height = measureMarkdownTextHeight(doc, '**wider** *a* c', fitsOnlyIfRegular, fontSize, lineGap, helvetica);
    assert.strictEqual(height, 2 * lineHeight);
  });

  it('skips several ranges that fall inside one word', () => {
    const doc = new PDFDocument();
    const r = helvetica.regular;
    const fitsOnlyIfRegular =
      widthOf(doc, [
        ['x', r],
        ['y', helvetica.italic],
        ['z', r],
        [' ', r],
        ['wider', r],
      ]) + 0.01;
    const height = measureMarkdownTextHeight(doc, 'x*y*z **wider**', fitsOnlyIfRegular, fontSize, lineGap, helvetica);
    assert.strictEqual(height, 2 * lineHeight);
  });

  it('does not carry a style past the end of its range', () => {
    const doc = new PDFDocument();
    const r = helvetica.regular;
    const exactWidth =
      widthOf(doc, [
        ['a', r],
        [' ', r],
        ['b', helvetica.bold],
        [' ', r],
        ['wider', r],
        [' ', r],
        ['c', helvetica.italic],
        [' ', r],
        ['wider', r],
      ]) + 0.01;
    const height = measureMarkdownTextHeight(doc, 'a **b** wider *c* wider', exactWidth, fontSize, lineGap, helvetica);
    assert.strictEqual(height, lineHeight, 'both "wider" words are regular, so the line fits');
  });
});

describe('renderText styling', () => {
  const helvetica = fonts.standardFonts('Helvetica');

  async function runs(text: string, config: Partial<TextRenderConfig> = {}): Promise<TextRun[]> {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    renderText(doc, text, { typography: { fontSize: 12, fonts: helvetica }, layout: { x: 50, y: 50, width: 400 }, ...config });
    doc.end();
    return textRuns(await done);
  }

  it('draws markdown beside emoji without the markers and with the right styles', async () => {
    registerEmojiFont();
    const drawn = await runs('one **two** three 😀 four', { features: { enableEmoji: true, markdown: true } });
    assert.deepStrictEqual(
      drawn.map((r) => [r.font, r.text.replace(/\s+/g, ' ')]),
      [
        ['Helvetica', 'one '],
        ['Helvetica-Bold', 'two'],
        ['Helvetica', ' three '],
        ['Helvetica', ' four'],
      ]
    );
  });

  it('styles part of a word', async () => {
    const drawn = await runs('**Tools**: Git and a**b**c.', { features: { markdown: true } });
    assert.deepStrictEqual(
      drawn.map((r) => [r.font, r.text]),
      [
        ['Helvetica-Bold', 'Tools'],
        ['Helvetica', ': Git and a'],
        ['Helvetica-Bold', 'b'],
        ['Helvetica', 'c.'],
      ]
    );
    assert.strictEqual(new Set(drawn.map((r) => r.y)).size, 1, 'one line');
  });

  it('draws escapes and inline code without their markers', async () => {
    const drawn = await runs('Run `npm test` on \\*nix', { features: { markdown: true } });
    assert.deepStrictEqual(
      drawn.map((r) => r.text),
      ['Run npm test on *nix']
    );
  });

  it('starts a new line at each line break in markdown text', async () => {
    const drawn = await runs('one **two**\nthree\n\nfour', { features: { markdown: true } });
    const lineOf = (text: string): number => drawn.find((r) => r.text.includes(text))?.y ?? Number.NaN;
    assert.strictEqual(lineOf('one'), lineOf('two'), 'one and two share a line');
    assert.ok(lineOf('three') < lineOf('two'), 'three is on the next line');
    const lineHeight = lineOf('two') - lineOf('three');
    assert.ok(Math.abs(lineOf('three') - lineOf('four') - 2 * lineHeight) < 0.01, 'a blank line separates paragraphs');
  });

  it('measures line breaks the way it draws them', () => {
    const doc = new PDFDocument();
    const lineHeight = doc.font('Helvetica').fontSize(12).currentLineHeight(true);
    const height = measureMarkdownTextHeight(doc, 'one **two**\nthree\n\nfour', 400, 12, 0, helvetica);
    assert.strictEqual(height, 4 * lineHeight);
  });

  it('draws markdown spans in the text color and links in the hyperlink color', async () => {
    const drawn = await runs('plain **bold** [link](https://example.com)', { features: { markdown: true }, color: { fillColor: '#ff0000', hyperlinkColor: '#0000ff' } });
    assert.deepStrictEqual(
      drawn.map((r) => [r.text, r.fill]),
      [
        ['plain ', '1 0 0'],
        ['bold', '1 0 0'],
        [' ', '1 0 0'],
        ['link', '0 0 1'],
      ]
    );
  });

  it('applies oblique, underline and strike from typography', async () => {
    const drawn = await runs('Slanted', { typography: { fontSize: 12, fonts: helvetica, oblique: true } });
    assert.strictEqual(drawn[0]?.oblique, true);

    for (const decoration of ['underline', 'strike'] as const) {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
      renderText(doc, 'Decorated', { typography: { fontSize: 12, fonts: helvetica, [decoration]: true }, layout: { x: 50, y: 50, width: 400 } });
      doc.end();
      assert.match(pageContents(await done).join('\n'), / l\nS\n/, `${decoration} line is stroked`);
    }
  });
});
