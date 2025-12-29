import type PDFKit from 'pdfkit';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_TEXT_FONT_SIZE, WRAP_EPSILON } from '../constants.ts';
import { measureEmoji, splitTextAndEmoji } from './emoji-renderer.js';
import { hasEmoji } from './fonts.js';
import type { PDFTextOptions } from './pdf-helpers.js';
import type { LayoutContent } from './yoga-layout.js';

/**
 * Content measurement utilities for determining heights before rendering.
 *
 * These functions measure content without modifying the document,
 * enabling Yoga layout to make informed page break decisions.
 */

/**
 * Measure the height of text content (with or without emoji).
 *
 * @param doc - PDFKit document (used for font metrics)
 * @param text - Text to measure
 * @param fontSize - Font size in points
 * @param fontName - Font name for metrics
 * @param emojiAvailable - Whether emoji rendering is available
 * @param options - Text layout options (width, lineGap, indent, etc.)
 * @returns Height in points
 */
export function measureTextHeight(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, emojiAvailable: boolean, options: PDFTextOptions = {}): number {
  if (!text || text.trim() === '') {
    return 0;
  }

  // Save current state (using type assertion for internal PDFKit properties)
  const pdfDoc = doc as unknown as { _font?: { name: string }; _fontSize?: number };
  const savedFont = pdfDoc._font?.name;
  const savedFontSize = pdfDoc._fontSize;

  // Set font for measurements
  doc.fontSize(fontSize).font(fontName);

  // Calculate available width
  const availableWidth = options.width || doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const effectiveWidth = availableWidth - (options.indent || 0);

  // Get actual line height from PDFKit (matches PDFKit's internal calculation)
  // currentLineHeight(true) = font's natural height with built-in gap
  // + lineGap = any extra spacing user requested
  const lineHeight = doc.currentLineHeight(true) + (options.lineGap ?? 0);

  let height: number;

  if (!emojiAvailable || !hasEmoji(text)) {
    // Use PDFKit's heightOfString directly
    height = doc.heightOfString(text, {
      width: effectiveWidth,
      lineGap: options.lineGap,
    });
  } else {
    // Complex case: manually calculate with emoji segments
    const lineCount = measureLinesWithEmoji(doc, text, fontSize, effectiveWidth);
    height = lineCount * lineHeight;
  }

  // Restore font state
  if (savedFont) {
    doc.font(savedFont);
  }
  if (savedFontSize) {
    doc.fontSize(savedFontSize);
  }

  return height;
}

/**
 * Count lines needed for text with emoji, accounting for wrapping.
 */
function measureLinesWithEmoji(doc: PDFKit.PDFDocument, text: string, fontSize: number, effectiveWidth: number): number {
  const segments = splitTextAndEmoji(text);

  // Break segments into words for wrapping measurement
  const words: Array<{ width: number }> = [];

  for (const segment of segments) {
    if (segment.type === 'emoji') {
      const emojiMetrics = measureEmoji(segment.content, fontSize);
      words.push({ width: emojiMetrics.width });
    } else {
      const textWords = segment.content.split(/(\s+)/);
      for (const word of textWords) {
        if (word.length > 0) {
          words.push({ width: doc.widthOfString(word) });
        }
      }
    }
  }

  // Simulate line wrapping with epsilon tolerance for floating-point precision
  let lineCount = 1;
  let currentLineWidth = 0;

  for (const word of words) {
    if (currentLineWidth + word.width > effectiveWidth + WRAP_EPSILON && currentLineWidth > 0) {
      lineCount++;
      currentLineWidth = word.width;
    } else {
      currentLineWidth += word.width;
    }
  }

  return lineCount;
}

/**
 * Measure the natural width of text content (for row layouts).
 *
 * @param doc - PDFKit document (used for font metrics)
 * @param text - Text to measure
 * @param fontSize - Font size in points
 * @param fontName - Font name for metrics
 * @param emojiAvailable - Whether emoji rendering is available
 * @returns Width in points
 */
export function measureTextWidth(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, emojiAvailable: boolean): number {
  if (!text || text.trim() === '') {
    return 0;
  }

  // Save current state
  const pdfDoc = doc as unknown as { _font?: { name: string }; _fontSize?: number };
  const savedFont = pdfDoc._font?.name;
  const savedFontSize = pdfDoc._fontSize;

  // Set font for measurements
  doc.fontSize(fontSize).font(fontName);

  let width: number;

  if (!emojiAvailable || !hasEmoji(text)) {
    // Use PDFKit's widthOfString directly
    width = doc.widthOfString(text);
  } else {
    // Complex case: measure text and emoji segments
    const segments = splitTextAndEmoji(text);
    width = 0;
    for (const segment of segments) {
      if (segment.type === 'emoji') {
        const emojiMetrics = measureEmoji(segment.content, fontSize);
        width += emojiMetrics.width;
      } else {
        width += doc.widthOfString(segment.content);
      }
    }
  }

  // Restore font state
  if (savedFont) {
    doc.font(savedFont);
  }
  if (savedFontSize) {
    doc.fontSize(savedFontSize);
  }

  return width;
}

/**
 * Create a width measurer function that can extract font info from LayoutContent.
 *
 * @param doc - PDFKit document
 * @param regularFont - Name of regular font
 * @param boldFont - Name of bold font
 * @param emojiAvailable - Whether emoji rendering is available
 * @returns Width measurer function compatible with yoga-layout
 */
export function createWidthMeasurer(doc: PDFKit.PDFDocument, regularFont: string, boldFont: string, emojiAvailable: boolean): (content: LayoutContent) => number {
  return (content: LayoutContent): number => {
    if (content.type !== 'text' && content.type !== 'heading') {
      return 0;
    }

    const text = content.text as string;
    if (!text) return 0;

    const fontSize = content.type === 'heading' ? ((content.fontSize as number) ?? DEFAULT_HEADING_FONT_SIZE) : ((content.fontSize as number) ?? DEFAULT_TEXT_FONT_SIZE);

    const fontName = content.type === 'heading' ? (content.bold !== false ? boldFont : regularFont) : content.bold ? boldFont : regularFont;

    return measureTextWidth(doc, text, fontSize, fontName, emojiAvailable);
  };
}

/**
 * Measure the height of an image element.
 *
 * @param specifiedHeight - Explicit height if provided
 * @param specifiedWidth - Explicit width if provided (used for aspect ratio)
 * @param naturalWidth - Natural image width (if known)
 * @param naturalHeight - Natural image height (if known)
 * @returns Height in points
 */
export function measureImageHeight(specifiedHeight?: number, specifiedWidth?: number, naturalWidth?: number, naturalHeight?: number): number {
  if (specifiedHeight !== undefined) {
    return specifiedHeight;
  }

  // If only width specified and natural dimensions known, calculate height
  if (specifiedWidth !== undefined && naturalWidth && naturalHeight) {
    return (specifiedWidth / naturalWidth) * naturalHeight;
  }

  // If no dimensions specified but natural dimensions known
  if (naturalHeight !== undefined) {
    return naturalHeight;
  }

  // No dimensions available - caller must provide dimensions
  return 0;
}

/**
 * Measure the height of a rectangle element.
 */
export function measureRectHeight(height: number): number {
  return height;
}

/**
 * Measure the height of a circle element (diameter).
 */
export function measureCircleHeight(radius: number): number {
  return radius * 2;
}

/**
 * Measure the height of a line element.
 */
export function measureLineHeight(y1: number, y2: number): number {
  return Math.abs(y2 - y1);
}

/**
 * Spacing measurement helper - convert moveDown lines to points.
 *
 * @param doc - PDFKit document (for line height calculation)
 * @param moveDown - Number of lines to move down
 * @returns Height in points
 */
export function measureMoveDown(doc: PDFKit.PDFDocument, moveDown: number): number {
  // PDFKit's moveDown uses current line height
  return moveDown * doc.currentLineHeight();
}

/**
 * Measure total height of a content group (for wrap: false blocks).
 *
 * @param items - Array of content items
 * @param measureItem - Function to measure individual items
 * @returns Total height in points
 */
export function measureGroupHeight<T>(items: T[], measureItem: (item: T) => number): number {
  return items.reduce((total, item) => total + measureItem(item), 0);
}
