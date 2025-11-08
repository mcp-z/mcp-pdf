import assert from 'node:assert/strict';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { needsUnicodeFont, setupFonts } from '../src/lib/fonts.ts';
import { cleanTmpDir, getTmpSubdir } from './test-helpers.ts';

let testOutputDir: string;

before(async () => {
  await cleanTmpDir();
  testOutputDir = await getTmpSubdir('emoji-tests');
});

async function createTestPDF(filename: string, text: string, fontSpec?: string): Promise<string> {
  const outputPath = join(testOutputDir, filename);

  const doc = new PDFDocument();
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  // Setup fonts
  const fonts = await setupFonts(doc, fontSpec);
  doc.font(fonts.regular).fontSize(24).text(text);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return outputPath;
}

describe('Emoji and Unicode Rendering', (): void => {
  it('detects emoji as needing Unicode font', (): void => {
    assert.strictEqual(needsUnicodeFont('Hello 👋'), true);
    assert.strictEqual(needsUnicodeFont('😀 🎉 🚀'), true);
    assert.strictEqual(needsUnicodeFont('Test ✅ ❌'), true);
  });

  it('creates PDF with emoji using default font', async (): Promise<void> => {
    const text = 'Hello World 👋 😀 🎉';
    const path = await createTestPDF('emoji-default.pdf', text);

    assert.ok(existsSync(path), 'PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with emoji using auto-detect font', async (): Promise<void> => {
    const text = 'Hello World 👋 😀 🎉';
    const path = await createTestPDF('emoji-auto.pdf', text, 'auto');

    assert.ok(existsSync(path), 'PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with various emoji categories', async (): Promise<void> => {
    const emojiTests = [
      { category: 'Smileys', text: '😀 😃 😄 😁 😆 😅 🤣 😂' },
      { category: 'Gestures', text: '👋 🤚 🖐 ✋ 🖖 👌 🤌' },
      { category: 'Symbols', text: '❤️ 💔 💯 ✅ ❌ ⭐ 🔥' },
      { category: 'Objects', text: '📱 💻 ⌨️ 🖥 🖨 📞 📧' },
    ];

    for (const { category, text } of emojiTests) {
      const filename = `emoji-${category.toLowerCase()}.pdf`;
      const path = await createTestPDF(filename, `${category}: ${text}`, 'auto');

      assert.ok(existsSync(path), `${category} PDF should be created`);
      const stats = readFileSync(path);
      console.log(`    📄 ${category}: ${path} (${stats.length} bytes)`);
    }
  });

  it('creates PDF with CJK characters', async (): Promise<void> => {
    const text = '你好世界 こんにちは世界 안녕하세요 세계';
    const path = await createTestPDF('unicode-cjk.pdf', text, 'auto');

    assert.ok(existsSync(path), 'CJK PDF should be created');
    const stats = readFileSync(path);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with mixed ASCII and emoji', async (): Promise<void> => {
    const text = `
Technical Skills:
• TypeScript 💙
• Node.js ⚡
• React ⚛️
• Testing ✅

Achievements:
🏆 First place in hackathon
🎯 100% test coverage
🚀 Launched 5 products
		`;

    const path = await createTestPDF('mixed-content.pdf', text, 'auto');

    assert.ok(existsSync(path), 'Mixed content PDF should be created');
    const stats = readFileSync(path);
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });

  it('creates PDF with font from URL', async (): Promise<void> => {
    // Noto Sans has good Unicode coverage
    const fontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.0/files/noto-sans-latin-400-normal.woff2';
    const text = 'Hello World 👋 Testing with downloaded font';

    const path = await createTestPDF('emoji-url-font.pdf', text, fontUrl);

    assert.ok(existsSync(path), 'PDF with URL font should be created');
    const stats = readFileSync(path);
    console.log(`    📄 Created: ${path} (${stats.length} bytes)`);
  });
});

// Print summary at the end
it('print test output directory', (): void => {
  console.log(`\n📁 Test PDFs generated in: ${testOutputDir}`);
  console.log('   Open these files to visually verify emoji rendering\n');
});
