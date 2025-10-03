import assert from 'node:assert/strict';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../src/lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../src/lib/fonts.ts';
import { renderTextWithEmoji } from '../src/lib/pdf-helpers.ts';

const testOutputDir = join(tmpdir(), 'mcp-pdf-enhanced-api');

/**
 * Helper function that simulates the enhanced create-pdf tool
 * This is what an agent would call with calculated values
 */
async function createPdfWithEnhancements(options: {
  outputPath: string;
  pageSetup?: {
    size?: [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
    backgroundColor?: string;
  };
  content: Array<
    | { type: 'text'; text: string; fontSize?: number; bold?: boolean; color?: string; x?: number; y?: number; width?: number; align?: string; oblique?: number | boolean; characterSpacing?: number; moveDown?: number }
    | { type: 'heading'; text: string; fontSize?: number; bold?: boolean; color?: string; x?: number; y?: number; width?: number; align?: string; oblique?: number | boolean; characterSpacing?: number; moveDown?: number }
    | { type: 'rect'; x: number; y: number; width: number; height: number; fillColor?: string; strokeColor?: string; lineWidth?: number }
    | { type: 'circle'; x: number; y: number; radius: number; fillColor?: string; strokeColor?: string; lineWidth?: number }
    | { type: 'line'; x1: number; y1: number; x2: number; y2: number; strokeColor?: string; lineWidth?: number }
    | { type: 'pageBreak' }
  >;
}) {
  const { outputPath, pageSetup, content } = options;

  // Create PDF document with optional page setup
  const docOptions: any = {};
  if (pageSetup?.size) docOptions.size = pageSetup.size;
  if (pageSetup?.margins) docOptions.margins = pageSetup.margins;

  const doc = new PDFDocument(docOptions);
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  // Draw background if specified
  if (pageSetup?.backgroundColor) {
    const pageSize = pageSetup?.size || [612, 792];
    doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
  }

  // Check if content has emoji
  const contentText = JSON.stringify(content);
  const containsEmoji = hasEmoji(contentText);
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  // Setup fonts
  const fonts = await setupFonts(doc);
  const { regular: regularFont, bold: boldFont } = fonts;

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
        const font = item.bold !== false && item.type === 'heading' ? boldFont : item.bold ? boldFont : regularFont;

        if (item.color) doc.fillColor(item.color);

        const options: any = {};
        if (item.x !== undefined) options.x = item.x;
        if (item.y !== undefined) options.y = item.y;
        if (item.align !== undefined) options.align = item.align;
        if (item.width !== undefined) options.width = item.width;
        if (item.oblique !== undefined) options.oblique = item.oblique;
        if (item.characterSpacing !== undefined) options.characterSpacing = item.characterSpacing;

        renderTextWithEmoji(doc, item.text, fontSize, font, emojiAvailable, options);

        if (item.color) doc.fillColor('black');
        if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
        break;
      }

      case 'rect': {
        doc.rect(item.x, item.y, item.width, item.height);
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
        doc.circle(item.x, item.y, item.radius);
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

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

describe('Enhanced API - Backward Compatibility', () => {
  test('old-style JSON works identically (no new features)', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'backward-compat.pdf');

    // Old-style content - no pageSetup, no colors, no shapes
    await createPdfWithEnhancements({
      outputPath,
      content: [
        { type: 'heading', text: 'Business Letter' },
        { type: 'text', text: 'This is a simple letter.', moveDown: 1 },
        { type: 'text', text: 'With multiple paragraphs.', moveDown: 0.5 },
        { type: 'text', text: 'No enhanced features used.' },
      ],
    });

    assert.ok(existsSync(outputPath), 'PDF should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    ✅ Backward compatible: ${outputPath} (${stats.length} bytes)`);
  });
});

describe('Enhanced API - New Features', () => {
  test('pageSetup: custom background color', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'custom-background.pdf');

    await createPdfWithEnhancements({
      outputPath,
      pageSetup: {
        backgroundColor: '#1a1a1a', // Dark gray
      },
      content: [
        { type: 'heading', text: 'Dark Theme Document', color: 'white', align: 'center' },
        { type: 'text', text: 'Text on dark background', color: '#cccccc', align: 'center' },
      ],
    });

    assert.ok(existsSync(outputPath));
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0);
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('pageSetup: custom margins and size', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'custom-margins.pdf');

    await createPdfWithEnhancements({
      outputPath,
      pageSetup: {
        size: [612, 792],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      content: [{ type: 'text', text: 'Full bleed document with zero margins', x: 50, y: 50 }],
    });

    assert.ok(existsSync(outputPath));
    console.log(`    📄 Created: ${outputPath}`);
  });

  test('text colors', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'text-colors.pdf');

    await createPdfWithEnhancements({
      outputPath,
      content: [
        { type: 'heading', text: 'Colorful Document', color: '#FF6B6B' },
        { type: 'text', text: 'Red text', color: '#FF0000', moveDown: 0.5 },
        { type: 'text', text: 'Blue text', color: '#0000FF', moveDown: 0.5 },
        { type: 'text', text: 'Green text', color: '#00FF00', moveDown: 0.5 },
        { type: 'text', text: 'Gold text', color: '#FFD700' },
      ],
    });

    assert.ok(existsSync(outputPath));
    console.log(`    📄 Created: ${outputPath}`);
  });

  test('shapes: rectangles, circles, lines', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'shapes.pdf');

    await createPdfWithEnhancements({
      outputPath,
      content: [
        // Rectangle header
        { type: 'rect', x: 0, y: 0, width: 612, height: 80, fillColor: '#4A90E2' },
        { type: 'heading', text: 'Shapes Demo', color: 'white', align: 'center', y: 30 },

        // Horizontal line
        { type: 'line', x1: 72, y1: 100, x2: 540, y2: 100, strokeColor: '#4A90E2', lineWidth: 2 },

        // Circles
        { type: 'circle', x: 150, y: 200, radius: 30, fillColor: '#FF6B6B' },
        { type: 'circle', x: 300, y: 200, radius: 30, fillColor: '#4ECDC4' },
        { type: 'circle', x: 450, y: 200, radius: 30, fillColor: '#FFD93D' },

        // Rectangle with border
        { type: 'rect', x: 100, y: 300, width: 200, height: 100, fillColor: '#F0F0F0', strokeColor: '#333333', lineWidth: 3 },
      ],
    });

    assert.ok(existsSync(outputPath));
    console.log(`    📄 Created: ${outputPath}`);
  });
});

describe('Enhanced API - Agent Workflow Simulation', () => {
  test('agent calculates progressive font sizes', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'agent-calc-fonts.pdf');

    // Simulate agent calculating progressive font sizes
    const lines = ['This line starts small', 'This line is slightly bigger', 'This line is medium', 'This line is getting large', 'This line is very large'];

    const content: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const progress = i / (lines.length - 1); // 0.0 to 1.0
      const fontSize = 8 + progress * 16; // 8pt → 24pt

      content.push({
        type: 'text',
        text: lines[i],
        fontSize,
        align: 'center',
        moveDown: 0.5,
      });
    }

    await createPdfWithEnhancements({ outputPath, content });

    assert.ok(existsSync(outputPath));
    console.log(`    📊 Agent calculated ${lines.length} progressive font sizes`);
    console.log(`    📄 Created: ${outputPath}`);
  });

  test('agent calculates centered tapering widths', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'agent-calc-widths.pdf');

    const lines = ['Narrow', 'Getting Wider', 'Even Wider Now', 'Maximum Width Here', 'Full Text Width'];

    const pageWidth = 612;
    const content: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const progress = i / (lines.length - 1);
      const width = 150 + progress * 300; // 150px → 450px
      const x = (pageWidth - width) / 2; // Center it

      content.push({
        type: 'text',
        text: lines[i],
        width,
        x,
        align: 'center',
        fontSize: 14,
        moveDown: 0.5,
      });
    }

    await createPdfWithEnhancements({ outputPath, content });

    assert.ok(existsSync(outputPath));
    console.log(`    📊 Agent calculated ${lines.length} centered tapered widths`);
    console.log(`    📄 Created: ${outputPath}`);
  });
});

describe('Enhanced API - Space Journey Resume (Sci-Fi Style)', () => {
  test('generates space journey resume with tapering', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'space-journey-resume.pdf');

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
    const content: any[] = [];

    // First, add the space opening line
    content.push({
      type: 'text',
      text: resumeLines[0],
      fontSize: 11,
      color: '#00D9FF', // Cyan
      align: 'center',
      moveDown: 1.5,
    });

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
        x,
        align: 'center',
        oblique: 15, // Italic slant for perspective
        characterSpacing: 0.3,
        moveDown: isHeading ? 0.4 : 0.2,
      });
    }

    await createPdfWithEnhancements({
      outputPath,
      pageSetup: {
        backgroundColor: '#0A0A1F', // Deep space purple-black instead of pure black
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
      },
      content,
    });

    assert.ok(existsSync(outputPath), 'Space journey PDF should be created');
    const stats = readFileSync(outputPath);

    // Validation: Check file size is reasonable (should be ~10-12KB)
    assert.ok(stats.length > 8000 && stats.length < 15000, `PDF size should be reasonable (got ${stats.length} bytes)`);

    console.log(`    🌟 Space Journey Resume created: ${outputPath} (${stats.length} bytes)`);
    console.log(`    📊 Agent calculated ${mainContent.length} progressive values`);
    console.log('    ✨ Features: tapering font (7→20pt), tapering width (250→500px), centered, oblique');
    console.log('    🎨 Color scheme: Purple/Cyan on deep space background');
  });
});

test('print test output directory', () => {
  console.log(`\n📁 Enhanced API test PDFs generated in: ${testOutputDir}`);
  console.log('   Open these files to verify:');
  console.log('   • Backward compatibility (old JSON still works)');
  console.log('   • New features (colors, shapes, pageSetup)');
  console.log('   • Agent workflows (calculated values)');
  console.log('   • Space Journey resume (tapering effect)\n');
});
