import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { setupFonts } from '../src/lib/fonts.ts';

const outputPath = join(tmpdir(), 'space-crawl.pdf');

async function generateSpaceCrawl() {
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

  // Title: "A long time ago..."
  doc.moveDown(3);
  doc
    .fontSize(14)
    .font(regularFont)
    .fillColor('#4DA6FF') // Light blue
    .text('In the vastness of space and time,', { align: 'center' });
  doc.text('distant galaxies await...', { align: 'center' });

  doc.moveDown(4);

  // Episode title
  doc.fillColor('#FFD700');
  doc.fontSize(20).font(boldFont).text('THE ODYSSEY BEGINS', { align: 'center', characterSpacing: 2 });

  doc.moveDown(2);

  // Opening crawl text with perspective effect (simulate by using increasing font sizes - starts far away, gets closer)
  const crawlText = [
    { size: 10, text: 'Across the cosmic expanse,' },
    { size: 10, text: 'civilizations rise and fall.' },
    { size: 11, text: 'Technology advances beyond' },
    { size: 11, text: 'imagination.' },
    { size: 12, text: '' },
    { size: 12, text: 'In this age of discovery,' },
    { size: 12, text: 'explorers venture into' },
    { size: 13, text: 'uncharted territories, seeking' },
    { size: 13, text: 'knowledge and understanding' },
    { size: 14, text: 'among the distant stars' },
    { size: 14, text: 'of the outer rim.' },
    { size: 15, text: '' },
    { size: 15, text: 'While the council debates' },
    { size: 15, text: 'the future of exploration,' },
    { size: 16, text: 'brave pioneers continue their' },
    { size: 16, text: 'journey through the cosmos,' },
    { size: 17, text: 'documenting discoveries and' },
    { size: 17, text: 'sharing their findings with' },
    { size: 18, text: 'all who dare to dream of' },
    { size: 18, text: 'what lies beyond the horizon...' },
  ];

  doc.font(boldFont).fillColor('#FFD700');

  for (const line of crawlText) {
    if (line.text === '') {
      doc.moveDown(0.3);
    } else {
      doc.fontSize(line.size).text(line.text, {
        align: 'center',
        oblique: 15, // Slight slant for perspective
        characterSpacing: 0.5,
      });
      doc.moveDown(0.2);
    }
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  console.log(`\n✅ Space crawl PDF created: ${outputPath}\n`);
  console.log('📄 Features demonstrated:');
  console.log('   • Black background fill');
  console.log('   • Custom text colors (gold, blue)');
  console.log('   • Multiple font sizes for perspective');
  console.log('   • Center alignment');
  console.log('   • Oblique (italic) text');
  console.log('   • Character spacing');
  console.log('   • Precise spacing control (moveDown)');
}

generateSpaceCrawl().catch(console.error);
