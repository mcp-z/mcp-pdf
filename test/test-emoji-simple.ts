import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../src/lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../src/lib/fonts.ts';
import { renderTextWithEmoji } from '../src/lib/pdf-helpers.ts';

const testOutputDir = join(tmpdir(), 'mcp-pdf-emoji-test');

async function testEmojiRendering() {
  await mkdir(testOutputDir, { recursive: true });
  const outputPath = join(testOutputDir, 'emoji-test.pdf');

  const doc = new PDFDocument();
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  const text = 'Hello 👋 World 🌍! This is a test 🎉';
  const containsEmoji = hasEmoji(text);
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  console.log(`Emoji detected: ${containsEmoji}`);
  console.log(`Emoji font available: ${emojiAvailable}`);

  const fonts = await setupFonts(doc);
  const { regular: regularFont } = fonts;

  renderTextWithEmoji(doc, text, 24, regularFont, emojiAvailable);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  console.log(`✅ PDF created: ${outputPath}`);
}

testEmojiRendering().catch(console.error);
