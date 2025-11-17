import emojiRegexFactory from 'emoji-regex';
import { openSync as fontkitOpenSync } from 'fontkit';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type PDFKit from 'pdfkit';

export interface FontConfig {
  regular: string;
  bold: string;
  oblique: string;
}

// All 14 PDF Standard Fonts (built into PDF spec, no files needed)
export const PDF_STANDARD_FONTS = ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique', 'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique', 'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic', 'Symbol', 'ZapfDingbats'] as const;

export type PDFStandardFont = (typeof PDF_STANDARD_FONTS)[number];

/**
 * Type guard to check if a string is a PDF standard font
 */
export function isPDFStandardFont(font: string): font is PDFStandardFont {
  return (PDF_STANDARD_FONTS as readonly string[]).includes(font);
}

/**
 * Detect if text contains Unicode characters beyond ASCII + Latin-1
 * Returns true if font needs Unicode support (emoji, CJK, Cyrillic, Arabic, etc.)
 */
export function needsUnicodeFont(text: string): boolean {
  // Anything beyond ASCII + Latin-1 (0x00-0xFF) needs Unicode font
  return /[\u0100-\uFFFF]/.test(text);
}

/**
 * Detect if text contains emoji characters that need special rendering
 *
 * Uses the industry-standard emoji-regex package to detect all valid emoji
 * as per the Unicode Standard, including:
 * - ZWJ sequences (👨‍💼, 🧘‍♂️)
 * - Variation selectors (️)
 * - Skin tone modifiers (🏻-🏿)
 * - Flag sequences (🇺🇸)
 * - Keycap sequences (0️⃣-9️⃣, #️⃣, *️⃣)
 * - All other emoji per Unicode Standard
 *
 * @param text - Text to check for emoji
 * @returns True if text contains emoji
 */
export function hasEmoji(text: string): boolean {
  // Use emoji-regex package for accurate, up-to-date emoji detection
  const emojiRegex = emojiRegexFactory();
  return emojiRegex.test(text);
}

/**
 * Auto-detect a system font with Unicode support
 * Returns path to first found Unicode-capable font, or null if none found
 * Prioritizes fonts with known CJK (Chinese/Japanese/Korean) support
 */
export function getSystemFont(): string | null {
  // System fonts ordered by Unicode/CJK support quality
  const unicodeSupportedFonts = [
    // macOS - prioritize Arial Unicode (full CJK support)
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf', // 50k+ glyphs, full CJK
    '/System/Library/Fonts/SFNS.ttf', // System font (limited CJK)
    '/System/Library/Fonts/SFNSText.ttf',
    // Linux - Noto fonts have excellent CJK support
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    // Windows - Segoe UI has better Unicode than Arial
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\NotoSans-Regular.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ];

  for (const fontPath of unicodeSupportedFonts) {
    if (existsSync(fontPath)) {
      return fontPath;
    }
  }

  return null;
}

/**
 * Download font from URL to temp directory
 * Returns path to downloaded font, or null on error
 * Caches downloads - if the file already exists, returns cached path
 */
async function downloadToTemp(url: string): Promise<string | null> {
  try {
    const tempDir = join(tmpdir(), 'server-pdf-fonts');
    await mkdir(tempDir, { recursive: true });

    // Extract filename from URL or generate one
    const urlPath = new URL(url).pathname;
    const filename = urlPath.split('/').pop() || `font-${Date.now()}.woff2`;
    const tempPath = join(tempDir, filename);

    // Check if already cached
    if (existsSync(tempPath)) {
      console.log(`Using cached font: ${filename}`);
      return tempPath;
    }

    // Download if not cached
    console.log(`Downloading font: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download font from ${url}: ${response.statusText}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    await writeFile(tempPath, Buffer.from(buffer));
    console.log(`Font cached: ${filename}`);
    return tempPath;
  } catch (err) {
    console.warn(`Failed to download font from ${url}:`, err);
    return null;
  }
}

/**
 * Resolve font specification to actual font path or name
 * Supports: PDF standard fonts, absolute paths, URLs, 'auto' detection
 */
export async function resolveFont(fontSpec: string): Promise<string | null> {
  // 1. Check if it's a PDF standard font (built-in, no file needed)
  if (isPDFStandardFont(fontSpec)) {
    return fontSpec;
  }

  // 2. Auto-detect system font
  if (fontSpec === 'auto') {
    return getSystemFont();
  }

  // 3. Absolute path
  if (fontSpec.startsWith('/') || fontSpec.match(/^[A-Z]:\\/)) {
    return existsSync(fontSpec) ? fontSpec : null;
  }

  // 4. URL (http/https)
  if (fontSpec.startsWith('http://') || fontSpec.startsWith('https://')) {
    return await downloadToTemp(fontSpec);
  }

  // Unknown font specification
  return null;
}

/**
 * Setup fonts for PDF document
 * Resolves font specification and registers with PDFKit
 * Returns FontConfig with regular/bold/oblique variants
 */
export async function setupFonts(doc: PDFKit.PDFDocument, fontSpec?: string): Promise<FontConfig> {
  // Default to auto-detect if not specified
  const spec = fontSpec || 'auto';

  // Resolve the font
  const resolvedFont = await resolveFont(spec);

  // Fall back to Helvetica if resolution failed
  if (!resolvedFont) {
    console.warn(`Could not resolve font "${spec}", falling back to Helvetica`);
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      oblique: 'Helvetica-Oblique',
    };
  }

  // If it's a standard PDF font, use its variants
  if (isPDFStandardFont(resolvedFont)) {
    // Map to standard font families
    if (resolvedFont.startsWith('Helvetica')) {
      return {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold',
        oblique: 'Helvetica-Oblique',
      };
    }
    if (resolvedFont.startsWith('Times')) {
      return {
        regular: 'Times-Roman',
        bold: 'Times-Bold',
        oblique: 'Times-Italic',
      };
    }
    if (resolvedFont.startsWith('Courier')) {
      return {
        regular: 'Courier',
        bold: 'Courier-Bold',
        oblique: 'Courier-Oblique',
      };
    }

    // For Symbol or ZapfDingbats, just use as-is for all variants
    return {
      regular: resolvedFont,
      bold: resolvedFont,
      oblique: resolvedFont,
    };
  }

  // It's a custom font file - register it with PDFKit
  try {
    doc.registerFont('CustomFont', resolvedFont);
    // Use same font for all variants (simplicity)
    return {
      regular: 'CustomFont',
      bold: 'CustomFont',
      oblique: 'CustomFont',
    };
  } catch (err) {
    console.warn(`Failed to register font "${resolvedFont}":`, err);
    // Fall back to Helvetica
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      oblique: 'Helvetica-Oblique',
    };
  }
}

export interface CharacterValidationResult {
  hasUnsupportedCharacters: boolean;
  warnings: string[];
  unsupportedChars: Map<string, number>; // char -> codePoint
}

/**
 * Validate text against a specific font's glyph coverage
 *
 * For standard PDF fonts: checks WinAnsi range (0x20-0xFF)
 * For custom fonts: uses fontkit to check actual glyph support
 *
 * @param text - Text to validate
 * @param fontName - Font name (e.g., 'Helvetica', 'CustomFont')
 * @param fontPath - Path to font file (required for custom fonts)
 * @returns Validation result with warnings
 */
export function validateTextForFont(text: string, fontName: string, fontPath?: string): CharacterValidationResult {
  const result: CharacterValidationResult = {
    hasUnsupportedCharacters: false,
    warnings: [],
    unsupportedChars: new Map(),
  };

  // Check if it's a standard PDF font
  const isStandardFont = PDF_STANDARD_FONTS.some((f) => {
    const baseName = f.split('-')[0];
    return baseName && fontName.startsWith(baseName);
  });

  if (isStandardFont) {
    // Standard PDF fonts only support WinAnsi encoding (0x20-0xFF)
    for (const char of text) {
      const code = char.charCodeAt(0);

      if (code < 0x20 || code > 0xff) {
        result.hasUnsupportedCharacters = true;
        result.unsupportedChars.set(char, code);
      }
    }

    if (result.hasUnsupportedCharacters) {
      const chars = Array.from(result.unsupportedChars.entries())
        .slice(0, 5)
        .map(([char, code]) => `"${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')})`)
        .join(', ');
      const more = result.unsupportedChars.size > 5 ? ` and ${result.unsupportedChars.size - 5} more` : '';

      result.warnings.push(`Characters ${chars}${more} won't render in ${fontName}. Standard PDF fonts only support WinAnsi encoding (0x20-0xFF). Consider using a custom Unicode font or alternative characters.`);
    }
  } else if (fontPath && !fontName.startsWith('CustomFont')) {
    // Custom font - check actual glyph coverage using fontkit
    try {
      const fontOrCollection = fontkitOpenSync(fontPath);

      // Handle font collections (TTC files) - use first font
      const font = 'fonts' in fontOrCollection ? fontOrCollection.fonts[0] : fontOrCollection;

      if (!font) {
        console.warn(`Could not load font from "${fontPath}": font collection is empty`);
        return result;
      }

      for (const char of text) {
        const codePoint = char.codePointAt(0);
        if (codePoint && !font.hasGlyphForCodePoint(codePoint)) {
          result.hasUnsupportedCharacters = true;
          result.unsupportedChars.set(char, codePoint);
        }
      }

      if (result.hasUnsupportedCharacters) {
        const chars = Array.from(result.unsupportedChars.entries())
          .slice(0, 5)
          .map(([char, code]) => `"${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')})`)
          .join(', ');
        const more = result.unsupportedChars.size > 5 ? ` and ${result.unsupportedChars.size - 5} more` : '';

        result.warnings.push(`Characters ${chars}${more} are not supported by font ${fontName}. Consider using a different font or alternative characters.`);
      }
    } catch (err) {
      // If we can't load the font, we can't validate - remain silent
      console.warn(`Could not validate font "${fontPath}":`, err);
    }
  }

  // For unknown fonts or when we can't determine support, remain silent
  // (no false positives)

  return result;
}
