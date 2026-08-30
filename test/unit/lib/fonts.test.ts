import assert from 'assert';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';

// Import functions from source with proper TypeScript types
import { getSystemFont, hasEmoji, needsUnicodeFont, PDF_STANDARD_FONTS, resolveFont } from '../../../src/lib/fonts.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'fonts-tests');

describe('PDF_STANDARD_FONTS', (): void => {
  it('should contain all 14 standard PDF fonts', (): void => {
    assert.strictEqual(PDF_STANDARD_FONTS.length, 14);

    // Verify all standard fonts are present
    const expectedFonts = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique', 'Symbol', 'ZapfDingbats'] as const;

    for (const font of expectedFonts) {
      assert.ok((PDF_STANDARD_FONTS as readonly string[]).includes(font), `Should include ${font}`);
    }
  });
});

describe('hasEmoji', (): void => {
  it('returns false for ASCII-only text', (): void => {
    assert.strictEqual(hasEmoji('Hello World'), false);
    assert.strictEqual(hasEmoji('Test 123'), false);
    assert.strictEqual(hasEmoji(''), false);
  });

  it('returns false for Latin-1 characters', (): void => {
    assert.strictEqual(hasEmoji('Café'), false);
    assert.strictEqual(hasEmoji('résumé'), false);
  });

  it('returns false for non-emoji Unicode', (): void => {
    assert.strictEqual(hasEmoji('你好'), false);
    assert.strictEqual(hasEmoji('こんにちは'), false);
    assert.strictEqual(hasEmoji('Привет'), false);
  });

  it('returns false for Greek letters (render fine in standard fonts)', (): void => {
    assert.strictEqual(hasEmoji('Ξ'), false, 'Greek Xi should not be detected as emoji');
    assert.strictEqual(hasEmoji('Δ'), false, 'Greek Delta should not be detected as emoji');
    assert.strictEqual(hasEmoji('Ω'), false, 'Greek Omega should not be detected as emoji');
  });

  it('returns false for geometric shapes (render fine in standard fonts)', (): void => {
    assert.strictEqual(hasEmoji('△'), false, 'White triangle should not be detected as emoji');
    assert.strictEqual(hasEmoji('○'), false, 'White circle should not be detected as emoji');
    assert.strictEqual(hasEmoji('◆'), false, 'Black diamond should not be detected as emoji');
  });

  it('correctly identifies emoji per Unicode Standard', (): void => {
    // emoji-regex follows the official Unicode emoji list
    // ☑, ⚠, ✂ ARE emoji per Unicode Standard (they have color versions!)
    assert.strictEqual(hasEmoji('☑'), true, 'Checked ballot box IS an emoji per Unicode');
    assert.strictEqual(hasEmoji('⚠'), true, 'Warning sign IS an emoji per Unicode');
    assert.strictEqual(hasEmoji('✂'), true, 'Scissors IS an emoji per Unicode');

    // These are NOT on the official emoji list
    assert.strictEqual(hasEmoji('☐'), false, 'Ballot box is not an emoji');
    assert.strictEqual(hasEmoji('★'), false, 'Star is not an emoji');
    assert.strictEqual(hasEmoji('✓'), false, 'Check mark is not an emoji');
    assert.strictEqual(hasEmoji('✗'), false, 'X mark is not an emoji');
  });

  it('returns true for true color emoji (U+1F300-U+1F9FF)', (): void => {
    assert.strictEqual(hasEmoji('Hello 👋'), true, 'Waving hand is true emoji');
    assert.strictEqual(hasEmoji('😀'), true, 'Grinning face is true emoji');
    assert.strictEqual(hasEmoji('🎉'), true, 'Party popper is true emoji');
    assert.strictEqual(hasEmoji('🚀'), true, 'Rocket is true emoji');
  });

  it('returns true for extended emoji (U+1FA00-U+1FAFF)', (): void => {
    assert.strictEqual(hasEmoji('🪀'), true, 'Yo-yo is extended emoji');
    assert.strictEqual(hasEmoji('🫶'), true, 'Heart hands is extended emoji');
  });

  it('returns true for various true emoji categories', (): void => {
    assert.strictEqual(hasEmoji('💙'), true, 'Blue heart is true emoji');
    assert.strictEqual(hasEmoji('📱'), true, 'Mobile phone is true emoji');
    assert.strictEqual(hasEmoji('🔥'), true, 'Fire is true emoji');
    assert.strictEqual(hasEmoji('🏆'), true, 'Trophy is true emoji');
  });

  it('detects emoji in mixed content', (): void => {
    assert.strictEqual(hasEmoji('Skills: TypeScript 💙'), true);
    assert.strictEqual(hasEmoji('First place 🏆'), true);
  });

  it('correctly handles mixed symbols and emoji', (): void => {
    // Only symbols (not emoji)
    assert.strictEqual(hasEmoji('Ξ △ ☐ ○'), false, 'Only standard symbols should return false');

    // Mixed: symbols + true emoji
    assert.strictEqual(hasEmoji('Ξ △ ☐ ○ 😀'), true, 'Mix with true emoji should return true');
  });
});

describe('needsUnicodeFont', (): void => {
  it('returns false for ASCII-only text', (): void => {
    assert.strictEqual(needsUnicodeFont('Hello World'), false);
    assert.strictEqual(needsUnicodeFont('Test 123'), false);
    assert.strictEqual(needsUnicodeFont(''), false);
  });

  it('returns false for Latin-1 characters', (): void => {
    assert.strictEqual(needsUnicodeFont('Café'), false);
    assert.strictEqual(needsUnicodeFont('résumé'), false);
    assert.strictEqual(needsUnicodeFont('naïve'), false);
  });

  it('returns true for emoji', (): void => {
    assert.strictEqual(needsUnicodeFont('Hello 👋'), true);
    assert.strictEqual(needsUnicodeFont('😀 🎉'), true);
    assert.strictEqual(needsUnicodeFont('Test ✅'), true);
  });

  it('returns true for CJK characters', (): void => {
    assert.strictEqual(needsUnicodeFont('你好'), true);
    assert.strictEqual(needsUnicodeFont('こんにちは'), true);
    assert.strictEqual(needsUnicodeFont('안녕하세요'), true);
  });

  it('returns true for Cyrillic', (): void => {
    assert.strictEqual(needsUnicodeFont('Привет'), true);
    assert.strictEqual(needsUnicodeFont('Здравствуйте'), true);
  });

  it('returns true for Arabic', (): void => {
    assert.strictEqual(needsUnicodeFont('مرحبا'), true);
    assert.strictEqual(needsUnicodeFont('السلام عليكم'), true);
  });

  it('returns correctly for special symbols', (): void => {
    // ™ and € are beyond Latin-1, need Unicode
    assert.strictEqual(needsUnicodeFont('™'), true);
    assert.strictEqual(needsUnicodeFont('€'), true);
    // © and ® are in Latin-1 (0x00-0xFF), don't need Unicode
    assert.strictEqual(needsUnicodeFont('©'), false);
    assert.strictEqual(needsUnicodeFont('®'), false);
  });
});

describe('getSystemFont', (): void => {
  it('returns a font path or null', (): void => {
    const result: string | null = getSystemFont();
    // Result should be either null or a string path
    assert.ok(result === null || typeof result === 'string');
  });

  it('returns existing font path if found', (): void => {
    const result: string | null = getSystemFont();
    if (result !== null) {
      assert.ok(existsSync(result), `Font path should exist: ${result}`);
    }
  });
});

describe('resolveFont', (): void => {
  describe('built-in PDF fonts', (): void => {
    it('resolves Helvetica', async (): Promise<void> => {
      const result: string | null = await resolveFont('Helvetica');
      assert.strictEqual(result, 'Helvetica');
    });

    it('resolves Helvetica-Bold', async (): Promise<void> => {
      const result: string | null = await resolveFont('Helvetica-Bold');
      assert.strictEqual(result, 'Helvetica-Bold');
    });

    it('resolves Times-Roman', async (): Promise<void> => {
      const result: string | null = await resolveFont('Times-Roman');
      assert.strictEqual(result, 'Times-Roman');
    });

    it('resolves Courier-Oblique', async (): Promise<void> => {
      const result: string | null = await resolveFont('Courier-Oblique');
      assert.strictEqual(result, 'Courier-Oblique');
    });

    it('resolves Symbol', async (): Promise<void> => {
      const result: string | null = await resolveFont('Symbol');
      assert.strictEqual(result, 'Symbol');
    });

    it('resolves ZapfDingbats', async (): Promise<void> => {
      const result: string | null = await resolveFont('ZapfDingbats');
      assert.strictEqual(result, 'ZapfDingbats');
    });

    it('resolves all 14 standard fonts', async (): Promise<void> => {
      for (const fontName of PDF_STANDARD_FONTS) {
        const result: string | null = await resolveFont(fontName);
        assert.strictEqual(result, fontName, `Should resolve ${fontName}`);
      }
    });
  });

  describe('auto-detect', (): void => {
    it('resolves "auto" to system font', async (): Promise<void> => {
      const result: string | null = await resolveFont('auto');
      // Should be either null (no font found) or a path
      assert.ok(result === null || typeof result === 'string');
    });
  });

  describe('absolute paths', (): void => {
    before(() => {
      mkdirSync(testOutputDir, { recursive: true });
    });

    after(() => {
      if (existsSync(testOutputDir)) {
        safeRmSync(testOutputDir, { recursive: true, force: true });
      }
    });

    it('resolves existing absolute path', async (): Promise<void> => {
      // Create a temp file to test
      const testFont: string = join(testOutputDir, 'test.ttf');
      writeFileSync(testFont, 'fake font data');

      const result: string | null = await resolveFont(testFont);
      assert.strictEqual(result, testFont);
    });

    it('returns null for non-existent path', async (): Promise<void> => {
      const result: string | null = await resolveFont('/nonexistent/font.ttf');
      assert.strictEqual(result, null);
    });

    it('handles Windows paths', async (): Promise<void> => {
      const result: string | null = await resolveFont('C:\\Windows\\Fonts\\nonexistent.ttf');
      // Should return null since file doesn't exist
      assert.strictEqual(result, null);
    });
  });

  describe('URLs', (): void => {
    it('downloads font from valid URL', async (): Promise<void> => {
      // This will actually download - use a small font
      const url: string = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.0.0/files/noto-sans-latin-400-normal.woff2';
      const result: string | null = await resolveFont(url);

      assert.ok(result !== null, 'Should download font');
      assert.ok(typeof result === 'string', 'Should return path string');
      assert.ok(existsSync(result), 'Downloaded font should exist');
    });

    it('throws error for invalid URL', async (): Promise<void> => {
      await assert.rejects(async () => await resolveFont('https://invalid.example.com/font.ttf'), /fetch failed|ENOTFOUND/, 'Should throw error for invalid URL');
    });
  });

  describe('invalid fonts', (): void => {
    it('returns null for unknown font name', async (): Promise<void> => {
      const result: string | null = await resolveFont('UnknownFont');
      assert.strictEqual(result, null);
    });

    it('returns null for empty string', async (): Promise<void> => {
      const result: string | null = await resolveFont('');
      assert.strictEqual(result, null);
    });
  });
});

// setupFonts tests skipped - require PDFKit instantiation
// These will be tested via integration tests instead
