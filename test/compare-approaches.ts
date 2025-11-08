import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../src/lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../src/lib/fonts.ts';
import { renderTextWithEmoji } from '../src/lib/pdf-helpers.ts';

const outputDir = tmpdir();

/**
 * Approach 1: Algorithmic (custom code) - What we built in space-resume-full.ts
 */
async function generateWithAlgorithm() {
  const outputPath = join(outputDir, 'space-resume-ALGORITHM.pdf');

  const doc = new PDFDocument({
    size: [612, 792],
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
  });

  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  const fonts = await setupFonts(doc);
  const { regular: regularFont, bold: boldFont } = fonts;

  const pageWidth = 612;

  // Black background
  doc.rect(0, 0, 612, 792).fill('black');

  doc.on('pageAdded', () => {
    doc.rect(0, 0, 612, 792).fill('black');
  });

  doc.moveDown(2);
  doc.fontSize(11).font(regularFont).fillColor('#4DA6FF');
  doc.text('IN THE VASTNESS OF SPACE AND TIME...', { align: 'center' });
  doc.moveDown(1.5);

  const resumeLines = [
    'THE ODYSSEY OF ALEX QUANTUM',
    'Chapter I: The Engineer Awakens',
    '',
    'Home World: San Francisco, CA, USA',
    'Holotransmission: +1 (555) 123-4567 | DataNet: alex@example.com',
    '',
    'In an era when organizations needed visionaries, one engineer discovered they possessed',
    'a rare gift - the ability to unite teams, modernize legacy systems,',
    'and lead transformations through impossible challenges. This is their story...',
    '',
    "THE HERO'S JOURNEY",
    '',
    'Chapter VII: The Platform Awakening (2024-2025)',
    'Alliance: TechCorp Industries | Title: Senior Engineering Manager',
    '',
    'Our hero discovered a critical challenge - users across the organization',
    'needed better tools for collaboration. Armed with modern cloud technologies',
    'and AI-driven insights, Alex led an expedition to modernize the platform.',
  ];

  for (let i = 0; i < resumeLines.length; i++) {
    const line = resumeLines[i];
    if (!line) continue;

    if (line === '') {
      doc.moveDown(0.3);
      continue;
    }

    const progress = i / resumeLines.length;
    const fontSize = 7 + progress * 13;
    const width = 250 + progress * 250;
    const x = (pageWidth - width) / 2;

    const isHeading = line === line.toUpperCase() || line.startsWith('Chapter');
    const font = isHeading ? boldFont : regularFont;

    doc.fillColor('#FFD700');
    doc.fontSize(isHeading ? Math.max(fontSize, 12) : fontSize).font(font);

    renderTextWithEmoji(doc, line, isHeading ? Math.max(fontSize, 12) : fontSize, font, false, {
      x,
      width,
      align: 'center',
      oblique: 15,
      characterSpacing: 0.3,
    });

    doc.moveDown(isHeading ? 0.4 : 0.2);
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  console.log(`\n✅ ALGORITHM approach generated: ${outputPath}`);
  return outputPath;
}

/**
 * Approach 2: Enhanced Tool API (agent workflow)
 * Agent calculates all values, then calls tool once
 */
async function generateWithToolAPI() {
  const outputPath = join(outputDir, 'space-resume-TOOL-API.pdf');

  // Step 1: Agent prepares resume content
  const resumeLines = [
    'THE ODYSSEY OF ALEX QUANTUM',
    'Chapter I: The Engineer Awakens',
    '',
    'Home World: San Francisco, CA, USA',
    'Holotransmission: +1 (555) 123-4567 | DataNet: alex@example.com',
    '',
    'In an era when organizations needed visionaries, one engineer discovered they possessed',
    'a rare gift - the ability to unite teams, modernize legacy systems,',
    'and lead transformations through impossible challenges. This is their story...',
    '',
    "THE HERO'S JOURNEY",
    '',
    'Chapter VII: The Platform Awakening (2024-2025)',
    'Alliance: TechCorp Industries | Title: Senior Engineering Manager',
    '',
    'Our hero discovered a critical challenge - users across the organization',
    'needed better tools for collaboration. Armed with modern cloud technologies',
    'and AI-driven insights, Alex led an expedition to modernize the platform.',
  ];

  const pageWidth = 612;
  const content: any[] = [];

  // Step 2: Agent calculates and builds content array

  // Add opening line (no tapering)
  content.push({
    type: 'text',
    text: 'IN THE VASTNESS OF SPACE AND TIME...',
    fontSize: 11,
    color: '#4DA6FF',
    align: 'center',
    moveDown: 1.5,
  });

  // Add all lines with calculated tapering
  for (let i = 0; i < resumeLines.length; i++) {
    const line = resumeLines[i];
    if (!line) continue;

    if (line === '') {
      content.push({ type: 'text', text: '', fontSize: 1, moveDown: 0.3 });
      continue;
    }

    // Agent does these calculations
    const progress = i / resumeLines.length; // 0.0 to 1.0
    const fontSize = 7 + progress * 13; // 7pt → 20pt
    const width = 250 + progress * 250; // 250px → 500px
    const x = (pageWidth - width) / 2; // Center it

    // Determine if heading
    const isHeading = line === line.toUpperCase() || line.startsWith('Chapter');

    // Add to content array
    content.push({
      type: isHeading ? 'heading' : 'text',
      text: line,
      fontSize: isHeading ? Math.max(fontSize, 12) : fontSize,
      bold: isHeading,
      color: '#FFD700',
      width,
      x,
      align: 'center',
      oblique: 15,
      characterSpacing: 0.3,
      moveDown: isHeading ? 0.4 : 0.2,
    });
  }

  // Step 3: Agent calls the tool with all calculated values
  await createPdfWithToolAPI({
    outputPath,
    pageSetup: {
      backgroundColor: 'black',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
    },
    content,
  });

  console.log(`✅ TOOL API approach generated: ${outputPath}`);
  console.log(`   📊 Agent calculated ${resumeLines.length} progressive values`);
  console.log(`   📦 Content array size: ${content.length} items`);
  return outputPath;
}

/**
 * Helper that simulates the enhanced create-pdf tool
 */
async function createPdfWithToolAPI(options: {
  outputPath: string;
  pageSetup?: {
    size?: [number, number];
    margins?: { top: number; bottom: number; left: number; right: number };
    backgroundColor?: string;
  };
  content: Array<any>;
}) {
  const { outputPath, pageSetup, content } = options;

  const docOptions: any = {};
  if (pageSetup?.size) docOptions.size = pageSetup.size;
  if (pageSetup?.margins) docOptions.margins = pageSetup.margins;

  const doc = new PDFDocument(docOptions);
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  // Draw background
  if (pageSetup?.backgroundColor) {
    const pageSize = pageSetup?.size || [612, 792];
    doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
  }

  const contentText = JSON.stringify(content);
  const containsEmoji = hasEmoji(contentText);
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  const fonts = await setupFonts(doc);
  const { regular: regularFont, bold: boldFont } = fonts;

  // Background on new pages
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
          if (item.lineWidth) doc.lineWidth(item.lineWidth);
          doc.fillAndStroke(item.fillColor, item.strokeColor);
        } else if (item.fillColor) {
          doc.fill(item.fillColor);
        } else if (item.strokeColor) {
          if (item.lineWidth) doc.lineWidth(item.lineWidth);
          doc.stroke(item.strokeColor);
        }
        doc.fillColor('black');
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

async function compareApproaches() {
  console.log('\n🔬 COMPARISON: Algorithm vs Tool API\n');
  console.log('Generating Space Resume using both approaches...\n');

  const algoPath = await generateWithAlgorithm();
  const toolPath = await generateWithToolAPI();

  console.log('\n📊 COMPARISON RESULTS:\n');
  console.log('ALGORITHM approach:');
  console.log('  • Custom code with imperative loops');
  console.log('  • Calculates and renders in one pass');
  console.log('  • Direct PDFKit API access');
  console.log(`  • File: ${algoPath}`);
  console.log('');
  console.log('TOOL API approach:');
  console.log('  • Agent calculates all values first');
  console.log('  • Builds declarative content array');
  console.log('  • Calls tool once with full structure');
  console.log(`  • File: ${toolPath}`);
  console.log('');
  console.log(`📁 Both files generated in: ${outputDir}`);
  console.log('   Open both PDFs to visually compare!\n');
  console.log('Expected: Should be IDENTICAL in appearance\n');
}

compareApproaches().catch(console.error);
