import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { setupFonts } from '../src/lib/fonts.ts';

const outputDir = tmpdir();

async function generateSpaceResume(variant: 'classic' | 'dramatic' | 'compact') {
  const outputPath = join(outputDir, `space-resume-${variant}.pdf`);

  const doc = new PDFDocument({
    size: [612, 792], // Letter size
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  // Black background
  doc.rect(0, 0, 612, 792).fill('black');

  // Setup fonts
  const fonts = await setupFonts(doc);
  const { regular: regularFont, bold: boldFont } = fonts;

  // Yellow/gold color for text
  doc.fillColor('#FFD700');

  // Opening text
  doc.moveDown(2);
  doc
    .fontSize(12)
    .font(regularFont)
    .fillColor('#4DA6FF') // Light blue
    .text('IN THE VASTNESS OF SPACE AND TIME...', { align: 'center' });

  doc.moveDown(2);

  // Title
  doc.fillColor('#FFD700');
  doc.fontSize(20).font(boldFont).text('THE ODYSSEY OF ALEX QUANTUM', { align: 'center', characterSpacing: 2 });

  doc.moveDown(1);

  doc.fontSize(16).font(boldFont).text('Chapter I: The Engineer Awakens', { align: 'center', characterSpacing: 1 });

  doc.moveDown(1.5);

  // Contact header (small, centered)
  doc.fontSize(8).font(regularFont).fillColor('#FFD700');
  doc.text('Home World: San Francisco, CA, USA', { align: 'center' });
  doc.text('Holotransmission: +1 (555) 123-4567 | DataNet: alex@example.com', { align: 'center' });
  doc.text('Alliance Network: linkedin.com/in/alexquantum | Code Archives: github.com/alexquantum', { align: 'center' });

  doc.moveDown(1.5);

  // Different perspective settings for each variant
  let crawlText: Array<{ size: number; text: string; spacing?: number }>;

  if (variant === 'classic') {
    // Classic crawl: smooth gradient from far to near
    crawlText = [
      { size: 9, text: 'In an era when the galaxy needed heroes, one engineer discovered they possessed' },
      { size: 9, text: 'a rare gift - the ability to unite teams, modernize legacy systems,' },
      { size: 10, text: 'and lead organizations through impossible transformations. This is their story...' },
      { size: 10, text: '' },
      { size: 11, text: "THE HERO'S JOURNEY", spacing: 2 },
      { size: 11, text: '' },
      { size: 11, text: 'Chapter VII: The Platform Modernization (2024-2025)' },
      { size: 11, text: 'Alliance: TechCorp Industries | Title: Senior Engineering Manager' },
      { size: 12, text: '' },
      { size: 12, text: 'Our hero discovered a critical challenge - users across the organization' },
      { size: 12, text: 'needed better tools for collaboration. Armed with modern frameworks' },
      { size: 12, text: 'and cloud technologies, Alex led a transformation that would modernize' },
      { size: 13, text: 'the entire platform, bringing new capabilities to thousands of users.' },
      { size: 13, text: '' },
      { size: 13, text: "The organization's systems were fragmented across 500+ repositories." },
      { size: 14, text: 'Alex conceived The Unified Platform Initiative - a bold strategy to' },
      { size: 14, text: 'consolidate and modernize infrastructure across all engineering teams.' },
      { size: 15, text: 'Through careful planning and execution, balance was restored.' },
    ];
  } else if (variant === 'dramatic') {
    // Dramatic: more aggressive perspective with wider spacing
    crawlText = [
      { size: 8, text: 'In an era when the galaxy needed heroes, one engineer discovered' },
      { size: 8, text: 'they possessed a rare gift - the ability to unite teams,' },
      { size: 9, text: 'modernize legacy systems, and lead organizations through impossible' },
      { size: 9, text: 'transformations. This is their story...' },
      { size: 10, text: '' },
      { size: 12, text: "THE HERO'S JOURNEY", spacing: 3 },
      { size: 11, text: '' },
      { size: 11, text: 'Chapter VII: The Platform Modernization (2024-2025)' },
      { size: 11, text: 'Alliance: TechCorp Industries' },
      { size: 12, text: 'Title: Senior Engineering Manager' },
      { size: 12, text: '' },
      { size: 13, text: 'Our hero discovered a critical challenge - users across' },
      { size: 14, text: 'the organization needed better tools for collaboration.' },
      { size: 15, text: 'Armed with modern frameworks and cloud technologies,' },
      { size: 16, text: 'Alex led a transformation that would modernize' },
      { size: 17, text: 'the entire platform, bringing new capabilities' },
      { size: 18, text: 'to thousands of users.' },
    ];
  } else {
    // Compact: more content, gentler perspective
    crawlText = [
      { size: 9, text: 'In an era when the galaxy needed heroes, one engineer discovered they possessed a rare gift -' },
      { size: 9, text: 'the ability to unite teams, modernize legacy systems, and lead organizations through' },
      { size: 9, text: 'impossible transformations. This is their story...' },
      { size: 10, text: '' },
      { size: 12, text: "THE HERO'S JOURNEY", spacing: 2 },
      { size: 10, text: '' },
      { size: 10, text: 'Chapter VII: The Platform Modernization (2024-2025)' },
      { size: 9, text: 'Alliance: TechCorp Industries | Title: Senior Engineering Manager' },
      { size: 10, text: '' },
      { size: 10, text: 'Our hero discovered a critical challenge - users across the organization needed better tools' },
      { size: 10, text: 'for collaboration. Armed with modern frameworks and cloud technologies, Alex led a' },
      { size: 11, text: 'transformation that would modernize the entire platform, bringing new capabilities to thousands' },
      { size: 11, text: 'of users. Through microservices architecture and continuous deployment, they created a' },
      { size: 11, text: 'scalable system that would serve the organization for years to come.' },
      { size: 12, text: '' },
      { size: 12, text: "But the challenges continued. The organization's systems were fragmented across 500+" },
      { size: 12, text: 'repositories. Alex conceived The Unified Platform Initiative - a bold strategy to consolidate' },
      { size: 13, text: 'and modernize infrastructure across all engineering teams. Through careful planning and' },
      { size: 13, text: 'execution, balance was restored to the development ecosystem.' },
    ];
  }

  doc.font(boldFont).fillColor('#FFD700');

  for (const line of crawlText) {
    if (line.text === '') {
      doc.moveDown(0.3);
    } else {
      doc.fontSize(line.size).text(line.text, {
        align: 'center',
        oblique: 15, // Italic slant for perspective
        characterSpacing: line.spacing || 0.3,
      });
      doc.moveDown(variant === 'dramatic' ? 0.3 : 0.2);
    }
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  console.log(`\n✅ Space Resume (${variant}) created: ${outputPath}`);
  return outputPath;
}

async function generateAllVariants() {
  console.log('\n🌟 Generating Space Resume Variants...\n');

  const _classic = await generateSpaceResume('classic');
  const _dramatic = await generateSpaceResume('dramatic');
  const _compact = await generateSpaceResume('compact');

  console.log('\n📄 Variants generated:');
  console.log('   • CLASSIC: Smooth perspective gradient, traditional crawl feel');
  console.log('   • DRAMATIC: Aggressive perspective, wider spacing, bold impact');
  console.log('   • COMPACT: More content per page, gentler perspective\n');
  console.log('Open these files to compare and choose your favorite!\n');
}

generateAllVariants().catch(console.error);
