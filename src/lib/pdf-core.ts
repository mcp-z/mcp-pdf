/**
 * Shared PDF utilities for all PDF tools.
 *
 * This module provides common functionality used by pdf-layout, pdf-document, and pdf-resume tools.
 */

import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type PageSize, type PageSizePreset } from '../constants.ts';
import { registerEmojiFont } from './emoji-renderer.ts';
import { createFontValidator, hasEmoji, setupFonts } from './fonts.ts';
import type { TextRenderConfig } from './pdf-helpers.ts';
import type { FontConfig } from './types/typography.ts';

// ============================================================================
// Schemas - Shared content schemas used across tools
// ============================================================================

/**
 * Description of the `font` input shared by every tool that draws or measures text
 */
export const FONT_OPTION_DESCRIPTION =
  'Font (default: auto, a Unicode system font). Built-ins Helvetica, Times-Roman and Courier cover Latin-1 only. A path or URL to a .ttf, .otf or .ttc file renders every script the font covers; a .ttc collection supplies its own bold and italic faces, and bold or italic the font lacks is synthesized.';

/**
 * Description of the `markdown` input shared by every tool that draws text
 */
export const MARKDOWN_OPTION_DESCRIPTION = 'Parse inline markdown in text: **bold**, *italic*, [links](url), `code`, and backslash escapes. Line-start syntax such as "1." or "#" stays literal. Default: true; pass false to draw text exactly as written.';

/**
 * Text base properties shared between text and heading items
 */
export const textBaseSchema = z.object({
  text: z.string().optional().describe('Text content to render'),
  fontSize: z.number().optional().describe('Font size in points (default: 12 for text, 24 for heading)'),
  bold: z.boolean().optional().describe('Use bold font weight (default: false for text, true for heading)'),
  color: z.string().optional().describe('Text color as hex (e.g., "#333333") or named color (default: black)'),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment (default: left)'),
  indent: z.number().optional().describe('First line indent in points (default: 0)'),
  lineGap: z.number().optional().describe('Extra spacing between lines in points (default: 0)'),
  paragraphGap: z.number().optional().describe('Extra spacing after paragraph in points (default: 0)'),
  width: z.number().optional().describe('Text width for wrapping in points. Without width, text renders on a single line. Width depends on font, font size, and character count. Use text-measure tool for precise dimensions.'),
  moveDown: z.number().optional().describe('Move cursor down by N lines after rendering (default: 0)'),
  underline: z.boolean().optional().describe('Underline text (default: false)'),
  strike: z.boolean().optional().describe('Strikethrough text (default: false)'),
  oblique: z.union([z.boolean(), z.number()]).optional().describe('Italic/oblique text - true or angle in degrees (default: false)'),
  link: z.string().optional().describe('URL to link text to'),
  characterSpacing: z.number().optional().describe('Extra spacing between characters in points (default: 0)'),
  wordSpacing: z.number().optional().describe('Extra spacing between words in points (default: 0)'),
  continued: z.boolean().optional().describe('Continue text on same line (default: false)'),
  lineBreak: z.boolean().optional().describe('Allow line breaks (default: true)'),
});

export type TextBaseItem = z.infer<typeof textBaseSchema>;

/**
 * Common output schema for PDF generation results
 */
export const pdfOutputSchema = z.object({
  operationSummary: z.string(),
  itemsProcessed: z.number(),
  itemsChanged: z.number(),
  completedAt: z.string(),
  documentId: z.string(),
  filename: z.string(),
  uri: z.string(),
  sizeBytes: z.number(),
  pageCount: z.number().optional(),
  warnings: z.array(z.string()).optional(),
});

export type PDFOutput = z.infer<typeof pdfOutputSchema>;

// ============================================================================
// Page Size Utilities
// ============================================================================

/**
 * Resolve page size from preset name or custom dimensions.
 */
export function resolvePageSize(size: PageSizePreset | [number, number] | undefined): PageSize {
  if (!size) return DEFAULT_PAGE_SIZE;
  if (typeof size === 'string') {
    return PAGE_SIZES[size];
  }
  return { width: size[0], height: size[1] };
}

// ============================================================================
// PDF Document Factory
// ============================================================================

export interface PDFDocumentOptions {
  title?: string;
  author?: string;
  subject?: string;
  pageSize?: PageSizePreset | [number, number];
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  backgroundColor?: string;
}

export interface PDFDocumentSetup {
  doc: PDFKit.PDFDocument;
  pageSize: PageSize;
  pdfPromise: Promise<Buffer>;
  fonts: FontConfig;
  emojiAvailable: boolean;
  warnings: string[];
  actualPageCount: number;
}

/**
 * Create and configure a PDFKit document with common setup.
 *
 * Handles:
 * - Page size resolution
 * - Margins configuration
 * - Buffer accumulation
 * - Font setup
 * - Emoji support detection
 * - Background color application
 * - Page count tracking
 *
 * @param options - Document configuration options
 * @param font - Font specification (auto, built-in name, or path/URL)
 * @param contentForEmojiCheck - Content string to check for emoji characters
 * @returns Configured document and supporting utilities
 */
export async function createPDFDocument(options: PDFDocumentOptions, font: string | undefined, contentForEmojiCheck: string): Promise<PDFDocumentSetup> {
  const pageSize = resolvePageSize(options.pageSize);
  const defaultMargins = { top: 0, bottom: 0, left: 0, right: 0 };

  const docOptions = {
    info: {
      ...(options.title && { Title: options.title }),
      ...(options.author && { Author: options.author }),
      ...(options.subject && { Subject: options.subject }),
    },
    size: [pageSize.width, pageSize.height] as [number, number],
    margins: options.margins ?? defaultMargins,
  };

  const doc = new PDFDocument({ ...docOptions, autoFirstPage: false });

  // Buffer accumulation
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const pdfPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Setup fonts and emoji support
  const containsEmoji = hasEmoji(contentForEmojiCheck);
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
  const fonts = await setupFonts(doc, font);

  // Track page count and apply background to ALL pages consistently
  let actualPageCount = 0;
  const drawBackgroundOnPage = () => {
    actualPageCount++;
    if (options.backgroundColor) {
      doc.rect(0, 0, pageSize.width, pageSize.height).fill(options.backgroundColor);
      doc.fillColor('black');
    }
  };
  doc.on('pageAdded', drawBackgroundOnPage);

  // Add first page explicitly - goes through same event handler as all other pages
  doc.addPage();

  return {
    doc,
    pageSize,
    pdfPromise,
    fonts,
    emojiAvailable,
    warnings: [],
    get actualPageCount() {
      return actualPageCount;
    },
  };
}

// ============================================================================
// Text Item Rendering
// ============================================================================

export interface TextItemContext {
  fonts: FontConfig;
  fontSize: number;
  bold: boolean;
  emojiAvailable: boolean;
  markdown: boolean;
  hyperlinkColor: string;
  x?: number;
  y?: number;
  width?: number;
}

/**
 * Builds the renderText configuration for a text or heading item, carrying every option the item schema offers.
 */
export function textItemConfig(item: TextBaseItem, context: TextItemContext): TextRenderConfig {
  return {
    typography: { fontSize: context.fontSize, fonts: context.fonts, style: { bold: context.bold }, underline: item.underline, strike: item.strike, oblique: item.oblique },
    features: { enableEmoji: context.emojiAvailable, markdown: context.markdown },
    color: { fillColor: item.color, hyperlinkColor: context.hyperlinkColor },
    layout: { x: context.x, y: context.y, width: context.width ?? item.width, align: item.textAlign, indent: item.indent },
    spacing: { lineGap: item.lineGap, paragraphGap: item.paragraphGap, characterSpacing: item.characterSpacing, wordSpacing: item.wordSpacing, continued: item.continued, lineBreak: item.lineBreak },
    annotation: { link: item.link },
  };
}

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Validate text content against font capabilities.
 *
 * @param items - Array of content items to validate
 * @param fonts - Fonts the content is drawn with
 * @param warnings - Array to collect validation warnings
 */
export function validateContentText<T extends { type: string; text?: string; bold?: boolean; children?: T[] }>(items: T[], fonts: FontConfig, warnings: string[]): void {
  const validate = createFontValidator(fonts);
  const visit = (list: T[]): void => {
    for (const item of list) {
      if ((item.type === 'text' || item.type === 'heading') && item.text) {
        warnings.push(...validate(item.text).warnings);
      }
      if (item.children) visit(item.children);
    }
  };
  visit(items);
}
