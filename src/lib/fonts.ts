import emojiRegexFactory from 'emoji-regex';
import { type Font, openSync as fontkitOpenSync } from 'fontkit';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import type PDFKit from 'pdfkit';
import type { FontConfig } from './types/typography.ts';

export type { FontConfig } from './types/typography.ts';

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
 * Returns path to downloaded font
 * Caches downloads - if the file already exists, returns cached path
 * Throws error if download fails
 */
async function downloadToTemp(url: string): Promise<string> {
  const tempDir = join(tmpdir(), 'mcp-pdf-fonts');
  await mkdir(tempDir, { recursive: true });

  // Extract filename from URL or generate one
  const urlPath = new URL(url).pathname;
  const filename = urlPath.split('/').pop() || `font-${Date.now()}.woff2`;
  const tempPath = join(tempDir, filename);

  // Check if already cached
  if (existsSync(tempPath)) {
    return tempPath;
  }

  // Download if not cached
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Font download failed (HTTP ${response.status}): ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(tempPath, Buffer.from(buffer));
  return tempPath;
}

/**
 * Resolve font specification to actual font path or name
 * Supports: PDF standard fonts, absolute paths, URLs, 'auto' detection
 * Returns null if font cannot be resolved (caller should use fallback)
 * Throws error if URL download fails
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

  // 4. URL (http/https) - throws on download failure
  if (fontSpec.startsWith('http://') || fontSpec.startsWith('https://')) {
    return await downloadToTemp(fontSpec);
  }

  // Unknown font specification
  return null;
}

/**
 * Faces of a standard PDF font family. Symbol and ZapfDingbats have one face, used for every style.
 */
export function standardFonts(font: PDFStandardFont): FontConfig {
  if (font.startsWith('Helvetica')) return { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' };
  if (font.startsWith('Times')) return { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic', boldItalic: 'Times-BoldItalic' };
  if (font.startsWith('Courier')) return { regular: 'Courier', bold: 'Courier-Bold', italic: 'Courier-Oblique', boldItalic: 'Courier-BoldOblique' };
  return { regular: font, bold: font, italic: font, boldItalic: font };
}

const REGULAR_WEIGHT = 400;
const BOLD_WEIGHT = 700;

const faceWeight = (face: Font): number => face['OS/2']?.usWeightClass ?? REGULAR_WEIGHT;
const isBoldFace = (face: Font): boolean => Boolean(face['OS/2']?.fsSelection.bold) || faceWeight(face) >= BOLD_WEIGHT;
const isItalicFace = (face: Font): boolean => Boolean(face['OS/2']?.fsSelection.italic) || face.italicAngle !== 0;

/**
 * Registers the faces of a font file with the document. A collection (.ttc) contributes a face per style it
 * contains: bold by flag or weight 700+, italic by flag or slant, nearest to weight 400 or 700. Styles without
 * a face are marked synthetic.
 */
function registerFontFile(doc: PDFKit.PDFDocument, fontPath: string): FontConfig {
  const opened = fontkitOpenSync(fontPath);
  const isCollection = 'fonts' in opened;
  const faces = isCollection ? opened.fonts : [opened];
  const find = (bold: boolean, italic: boolean): Font | undefined => {
    const target = bold ? BOLD_WEIGHT : REGULAR_WEIGHT;
    const distance = (face: Font): number => Math.abs(faceWeight(face) - target);
    return faces.filter((f) => isBoldFace(f) === bold && isItalicFace(f) === italic).sort((a, b) => distance(a) - distance(b))[0];
  };
  const register = (face: Font): string => {
    doc.registerFont(face.postscriptName, fontPath, isCollection ? face.postscriptName : undefined);
    return face.postscriptName;
  };

  const regularFace = find(false, false) ?? faces[0];
  if (!regularFace) throw new Error(`Font collection ${fontPath} contains no fonts`);
  const boldFace = find(true, false);
  const italicFace = find(false, true);
  const boldItalicFace = find(true, true);
  const regular = register(regularFace);
  return {
    regular,
    bold: boldFace ? register(boldFace) : regular,
    italic: italicFace ? register(italicFace) : regular,
    ...(boldItalicFace && { boldItalic: register(boldItalicFace) }),
    synthetic: { bold: !boldFace, italic: !italicFace },
    file: fontPath,
  };
}

/**
 * Setup fonts for PDF document
 * Resolves font specification and registers its faces with PDFKit
 * Falls back to Helvetica if the font cannot be resolved
 */
export async function setupFonts(doc: PDFKit.PDFDocument, fontSpec: string | undefined): Promise<FontConfig> {
  // Resolve the font (may throw on URL download failure)
  const resolvedFont = await resolveFont(fontSpec || 'auto');
  if (!resolvedFont) return standardFonts('Helvetica');
  if (isPDFStandardFont(resolvedFont)) return standardFonts(resolvedFont);
  return registerFontFile(doc, resolvedFont);
}

export interface CharacterValidationResult {
  hasUnsupportedCharacters: boolean;
  warnings: string[];
  unsupportedChars: Map<string, number>; // char -> codePoint
}

function describeChars(unsupportedChars: Map<string, number>): string {
  const chars = Array.from(unsupportedChars.entries())
    .slice(0, 5)
    .map(([char, code]) => `"${char}" (U+${code.toString(16).toUpperCase().padStart(4, '0')})`)
    .join(', ');
  const more = unsupportedChars.size > 5 ? ` and ${unsupportedChars.size - 5} more` : '';
  return `${chars}${more}`;
}

function isStandardFontName(fontName: string): boolean {
  return PDF_STANDARD_FONTS.some((f) => {
    const baseName = f.split('-')[0];
    return baseName && fontName.startsWith(baseName);
  });
}

function validateStandardFont(text: string, fontName: string): CharacterValidationResult {
  const unsupportedChars = new Map<string, number>();
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code > 0xff) unsupportedChars.set(char, code);
  }
  if (unsupportedChars.size === 0) return { hasUnsupportedCharacters: false, warnings: [], unsupportedChars };
  return {
    hasUnsupportedCharacters: true,
    warnings: [`Characters ${describeChars(unsupportedChars)} won't render in ${fontName}. Standard PDF fonts only support WinAnsi encoding (0x20-0xFF). Consider using a custom Unicode font or alternative characters.`],
    unsupportedChars,
  };
}

function validateFontFile(text: string, fontName: string, font: Font): CharacterValidationResult {
  const unsupportedChars = new Map<string, number>();
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint && !font.hasGlyphForCodePoint(codePoint)) unsupportedChars.set(char, codePoint);
  }
  if (unsupportedChars.size === 0) return { hasUnsupportedCharacters: false, warnings: [], unsupportedChars };
  return {
    hasUnsupportedCharacters: true,
    warnings: [`Characters ${describeChars(unsupportedChars)} are not supported by font ${fontName}. Consider using a different font or alternative characters.`],
    unsupportedChars,
  };
}

/** Opens a font file with fontkit; a collection (TTC) yields its first font. */
function openFontFile(fontPath: string): Font {
  const fontOrCollection = fontkitOpenSync(fontPath);
  const font = 'fonts' in fontOrCollection ? fontOrCollection.fonts[0] : fontOrCollection;
  if (!font) throw new Error(`Font collection ${fontPath} contains no fonts`);
  return font;
}

/**
 * Validate text against a specific font's glyph coverage
 *
 * For standard PDF fonts: checks WinAnsi range (0x20-0xFF)
 * For custom fonts: uses fontkit to check actual glyph support
 *
 * @param text - Text to validate
 * @param fontName - Font name used in warnings (e.g., 'Helvetica')
 * @param fontPath - Path to font file (required for custom fonts)
 * @returns Validation result with warnings
 */
export function validateTextForFont(text: string, fontName: string, fontPath: string | undefined): CharacterValidationResult {
  if (isStandardFontName(fontName)) return validateStandardFont(text, fontName);
  if (!fontPath) return { hasUnsupportedCharacters: false, warnings: [], unsupportedChars: new Map() };
  return validateFontFile(text, fontName, openFontFile(fontPath));
}

/**
 * Returns a validator for text drawn with `fonts` (as returned by setupFonts).
 * A font file is opened on first use and held only as long as the validator.
 */
export function createFontValidator(fonts: FontConfig): (text: string) => CharacterValidationResult {
  const fontFile = fonts.file;
  if (!fontFile) return (text) => (isStandardFontName(fonts.regular) ? validateStandardFont(text, fonts.regular) : { hasUnsupportedCharacters: false, warnings: [], unsupportedChars: new Map() });
  const fontName = basename(fontFile, extname(fontFile));
  let font: Font | undefined;
  return (text) => {
    font ??= openFontFile(fontFile);
    return validateFontFile(text, fontName, font);
  };
}
