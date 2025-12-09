import type PDFKit from 'pdfkit';
import { splitTextAndEmoji } from './emoji-renderer.ts';
import { hasEmoji } from './fonts.ts';
import type { PDFTextOptions } from './pdf-helpers.ts';

/**
 * Content measurement utilities for determining heights before rendering.
 *
 * These functions measure content without modifying the document,
 * enabling the LayoutEngine to make informed page break decisions.
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

  // Calculate line height
  const lineHeight = fontSize * (options.lineGap !== undefined ? 1 + options.lineGap / fontSize : 1.15);

  let lineCount: number;

  if (!emojiAvailable || !hasEmoji(text)) {
    // Simple case: use PDFKit's heightOfString
    const textHeight = doc.heightOfString(text, {
      width: effectiveWidth,
      lineGap: options.lineGap,
    });
    lineCount = Math.ceil(textHeight / lineHeight);
  } else {
    // Complex case: manually calculate with emoji segments
    lineCount = measureLinesWithEmoji(doc, text, fontSize, effectiveWidth);
  }

  // Restore font state
  if (savedFont) {
    doc.font(savedFont);
  }
  if (savedFontSize) {
    doc.fontSize(savedFontSize);
  }

  return lineCount * lineHeight;
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
      words.push({ width: fontSize * 1.1 }); // Emoji width with spacing
    } else {
      const textWords = segment.content.split(/(\s+)/);
      for (const word of textWords) {
        if (word.length > 0) {
          words.push({ width: doc.widthOfString(word) });
        }
      }
    }
  }

  // Simulate line wrapping
  let lineCount = 1;
  let currentLineWidth = 0;

  for (const word of words) {
    if (currentLineWidth + word.width > effectiveWidth && currentLineWidth > 0) {
      lineCount++;
      currentLineWidth = word.width;
    } else {
      currentLineWidth += word.width;
    }
  }

  return lineCount;
}

/**
 * Measure the height of a heading element.
 * Headings default to larger font size and typically include spacing.
 */
export function measureHeadingHeight(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, emojiAvailable: boolean, options: PDFTextOptions = {}): number {
  return measureTextHeight(doc, text, fontSize, fontName, emojiAvailable, options);
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

  // Default fallback for images without known dimensions
  return 100;
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
 * @param moveDown - Number of lines to move down
 * @param fontSize - Current font size
 * @returns Height in points
 */
export function measureMoveDown(moveDown: number, fontSize: number): number {
  // PDFKit's moveDown uses line height based on current font size
  const lineHeight = fontSize * 1.15;
  return moveDown * lineHeight;
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
