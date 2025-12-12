import assert from 'assert';
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { registerEmojiFont } from '../../../../src/lib/emoji-renderer.ts';
import { needsUnicodeFont, setupFonts } from '../../../../src/lib/fonts.ts';
import { renderTextWithEmoji } from '../../../../src/lib/pdf-helpers.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'chinese-tests');

describe('Chinese/CJK Character Rendering', (): void => {
  before(() => {
    mkdirSync(testOutputDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should detect Chinese characters need Unicode font', async (): Promise<void> => {
    // Traditional Chinese
    assert.strictEqual(needsUnicodeFont('很久很久以前'), true);
    assert.strictEqual(needsUnicodeFont('凱文·馬拉科夫的傳奇'), true);

    // Simplified Chinese
    assert.strictEqual(needsUnicodeFont('很久很久以前'), true);

    // Japanese
    assert.strictEqual(needsUnicodeFont('こんにちは世界'), true);

    // Korean
    assert.strictEqual(needsUnicodeFont('안녕하세요'), true);

    // Mixed English and Chinese
    assert.strictEqual(needsUnicodeFont('Hello 世界'), true);
  });

  it('should render Chinese characters with auto font detection', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-chinese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      // Setup fonts with auto-detection
      const fonts = await setupFonts(doc, 'auto');

      // Render Chinese text
      const chineseText = '測試中文字符渲染';
      renderTextWithEmoji(doc, chineseText, 12, fonts.regular, false);

      // Render mixed text
      const mixedText = 'Hello 世界 World';
      renderTextWithEmoji(doc, mixedText, 12, fonts.regular, false);

      doc.end();

      // Wait for PDF to be written
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Verify PDF was created
      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      // Clean up
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should render Cantonese/Traditional Chinese text', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-cantonese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      const stream = doc.pipe(createWriteStream(outputPath));

      // Setup fonts with auto-detection
      const fonts = await setupFonts(doc, 'auto');

      // Render traditional Chinese headings and text
      const heading = '凱文·馬拉科夫的傳奇';
      const body = '在銀河系需要英雄的時代，一位工程師發現自己擁有一種罕見的天賦。';

      doc.font(fonts.bold);
      doc.fontSize(24);
      doc.text(heading, { align: 'center' });

      doc.moveDown();

      doc.font(fonts.regular);
      doc.fontSize(12);
      doc.text(body);

      doc.end();

      // Wait for PDF to be written
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      // Verify PDF was created
      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      // Clean up
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle Japanese characters', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-japanese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      const fonts = await setupFonts(doc, 'auto');

      // Hiragana and Kanji
      const japaneseText = 'こんにちは世界。これはテストです。';
      renderTextWithEmoji(doc, japaneseText, 12, fonts.regular, false);

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle Korean characters', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-korean-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      const fonts = await setupFonts(doc, 'auto');

      const koreanText = '안녕하세요 세계. 이것은 테스트입니다.';
      renderTextWithEmoji(doc, koreanText, 12, fonts.regular, false);

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should handle mixed CJK and emoji', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-mixed-cjk-emoji-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument();
      const stream = doc.pipe(createWriteStream(outputPath));

      // Register emoji font
      const emojiAvailable = registerEmojiFont();

      const fonts = await setupFonts(doc, 'auto');

      // Chinese with emoji
      const mixedText = '你好 👋 世界 🌍';
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      renderTextWithEmoji(doc, mixedText, 12, fonts.regular, emojiAvailable, { width: pageWidth });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });

  it('should gracefully handle missing Unicode font', async (): Promise<void> => {
    // This test verifies the fallback behavior when no Unicode font is available
    const doc = new PDFDocument();

    // Force a scenario where auto-detect might fail
    // setupFonts should fall back to Helvetica
    const fonts = await setupFonts(doc, 'invalid-font-spec');

    // Should return Helvetica fallback
    assert.strictEqual(fonts.regular, 'Helvetica');
    assert.strictEqual(fonts.bold, 'Helvetica-Bold');
    assert.strictEqual(fonts.oblique, 'Helvetica-Oblique');
  });

  it('should support Star Wars themed Chinese resume', async (): Promise<void> => {
    const outputPath = join(testOutputDir, `test-starwars-chinese-${Date.now()}.pdf`);

    try {
      const doc = new PDFDocument({
        size: [612, 792],
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });
      const stream = doc.pipe(createWriteStream(outputPath));

      // Black background
      doc.rect(0, 0, 612, 792).fill('#000000');

      const fonts = await setupFonts(doc, 'auto');

      // Star Wars opening crawl style
      doc.fillColor('#4A9EFF');
      doc.font(fonts.regular);
      doc.fontSize(14);
      doc.text('很久很久以前，在一個不太遙遠的銀河系...', { align: 'center' });

      doc.moveDown(1.5);

      // Title
      doc.fillColor('#FFD700');
      doc.font(fonts.bold);
      doc.fontSize(28);
      doc.text('凱文·馬拉科夫的傳奇', { align: 'center' });

      doc.moveDown(0.5);

      // Episode style
      doc.font(fonts.oblique);
      doc.fontSize(16);
      doc.text('第一章：英雄覺醒', { align: 'center' });

      doc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      assert.ok(existsSync(outputPath), 'PDF should be created');
      const stats = statSync(outputPath);
      assert.ok(stats.size > 0, 'PDF should have content');
    } finally {
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    }
  });
});
