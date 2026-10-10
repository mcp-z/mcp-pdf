import type PDFKit from 'pdfkit';
import { measureEmoji, renderEmojiToBuffer, splitTextAndEmoji } from './emoji-renderer.ts';
import { hasEmoji } from './fonts.ts';
import { tokenizeMarkdown, tokensToStyledSegments } from './markdown.ts';
import { drawText, selectFace, type TextPaint, type TextStyle } from './text-style.ts';
import type { FontConfig } from './types/typography.ts';

/**
 * PDFKit text rendering options
 */
export interface PDFTextOptions {
  x?: number;
  y?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: number;
  lineGap?: number;
  paragraphGap?: number;
  width?: number;
  underline?: boolean;
  strike?: boolean;
  oblique?: boolean | number;
  link?: string;
  characterSpacing?: number;
  wordSpacing?: number;
  continued?: boolean;
  lineBreak?: boolean;
  moveDown?: number;
}

// ============================================================================
// New Grouped Configuration API
// ============================================================================

export interface TypographyConfig {
  fontSize: number;
  fonts: FontConfig;
  style?: TextStyle;
  underline?: boolean;
  strike?: boolean;
  oblique?: boolean | number;
}

export interface ColorConfig {
  fillColor?: string;
  hyperlinkColor?: string;
}

export interface FeaturesConfig {
  enableEmoji?: boolean;
  markdown?: boolean;
}

export interface LayoutConfig {
  x?: number;
  y?: number;
  width?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: number;
}

export interface SpacingConfig {
  lineGap?: number;
  paragraphGap?: number;
  moveDown?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  continued?: boolean;
  lineBreak?: boolean;
}

export interface AnnotationConfig {
  link?: string;
}

export interface TextRenderConfig {
  typography: TypographyConfig;
  color?: ColorConfig;
  features?: FeaturesConfig;
  layout?: LayoutConfig;
  spacing?: SpacingConfig;
  annotation?: AnnotationConfig;
}

// ============================================================================
// End New Grouped Configuration API
// ============================================================================

/**
 * Render text with grouped configuration options.
 * New API that groups related options together for better organization.
 */
export function renderText(doc: PDFKit.PDFDocument, text: string, config: TextRenderConfig): void {
  const { typography, color = {}, features = {}, layout = {}, spacing = {}, annotation = {} } = config;

  const { fontSize, fonts, style = {}, underline, strike, oblique } = typography;
  const { fillColor = 'black', hyperlinkColor = '#0066CC' } = color;
  const { enableEmoji = false, markdown: shouldParseMarkdown = false } = features;
  const { x, y, width, align = 'left', indent = 0 } = layout;
  const { lineGap = 0, paragraphGap = 0, moveDown, characterSpacing = 0, wordSpacing = 0, continued = false, lineBreak = true } = spacing;
  const { link } = annotation;

  const options: PDFTextOptions = {
    x,
    y,
    width,
    align,
    indent,
    lineGap,
    paragraphGap,
    characterSpacing,
    wordSpacing,
    continued,
    lineBreak,
    moveDown,
    link,
    underline,
    strike,
    oblique,
  };

  renderTextUnified(doc, text, { fonts, style, fontSize, color: fillColor }, enableEmoji, shouldParseMarkdown, hyperlinkColor, options);
}

/**
 * Result from parsing markdown text for measurement/rendering
 */
interface ParsedMarkdownText {
  plainText: string;
  styleRanges: Array<{ start: number; end: number; bold: boolean; italic: boolean; isLink?: boolean; url?: string }>;
  hasMarkdownContent: boolean;
}

/**
 * Parse markdown text into plain text with style ranges.
 * Single source of truth for markdown parsing - used by both measurement and rendering.
 */
function parseMarkdownText(text: string, parseMarkdown: boolean): ParsedMarkdownText {
  const styledSegments = parseMarkdown ? tokensToStyledSegments(tokenizeMarkdown(text)) : null;
  const hasMarkdownContent = styledSegments !== null && styledSegments.some((s) => s.bold || s.italic || s.type === 'link');

  if (!hasMarkdownContent) {
    const plainText = styledSegments ? styledSegments.map((s) => s.content).join('') : text;
    return { plainText, styleRanges: [], hasMarkdownContent: false };
  }

  let plainText = '';
  const styleRanges: ParsedMarkdownText['styleRanges'] = [];
  for (const seg of styledSegments) {
    const start = plainText.length;
    plainText += seg.content;
    const end = plainText.length;
    styleRanges.push({ start, end, bold: seg.bold, italic: seg.italic, isLink: seg.type === 'link', url: seg.url });
  }

  return { plainText, styleRanges, hasMarkdownContent };
}

/**
 * Returns a lookup for the style range covering a character position.
 * Ranges are contiguous and in text order and callers ask in increasing position, so the cursor only moves forward.
 */
function styleCursor(styleRanges: ParsedMarkdownText['styleRanges']): (position: number) => ParsedMarkdownText['styleRanges'][number] | undefined {
  let index = 0;
  return (position) => {
    let range = styleRanges[index];
    while (range && range.end <= position) range = styleRanges[++index];
    return range && position >= range.start ? range : undefined;
  };
}

/**
 * Calculate the rendered height of text with markdown formatting.
 *
 * This function uses the same algorithm as renderTextUnified to calculate
 * how tall the text will be when rendered, accounting for:
 * - Bold text being wider (causing more line wrapping)
 * - Italic text
 * - Mixed font styles within the same text
 *
 * This ensures measurement matches rendering exactly.
 *
 * @param doc - PDFKit document for font measurements
 * @param text - Text with optional markdown formatting
 * @param width - Available width for text wrapping
 * @param fontSize - Font size in points
 * @param lineGap - Extra space between lines
 * @param fonts - Font configuration with regular/bold/italic variants
 * @param parseMarkdown - Whether to parse markdown (default: true)
 * @returns Height in points that the rendered text will occupy
 */
export function measureMarkdownTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number, lineGap: number, fonts: FontConfig, parseMarkdown = true, style: TextStyle = {}): number {
  selectFace(doc, fonts, style).fontSize(fontSize);

  // Parse markdown using shared helper
  const { plainText, styleRanges, hasMarkdownContent } = parseMarkdownText(text, parseMarkdown);

  // Plain text case - use simple heightOfString
  if (!hasMarkdownContent) {
    return doc.heightOfString(plainText, { width, lineGap });
  }

  const { lines, lineHeight } = layoutStyledText(doc, plainText, styleRanges, { fonts, style, fontSize, color: 'black' }, false, { width, lineGap });
  return lines.length * lineHeight;
}

/** Combines the base style with a markdown range's bold and italic. */
function withMarkdownStyle(style: TextStyle, range?: { bold: boolean; italic: boolean }): TextStyle {
  return { bold: style.bold || range?.bold, italic: style.italic || range?.italic };
}

type StyledWord = { type: 'text' | 'emoji'; content: string; width: number; isLink: boolean; linkUrl?: string; bold: boolean; italic: boolean };
type StyledLine = { words: StyledWord[]; width: number };

/**
 * Splits styled text into words measured in their own faces and wraps them into lines; line breaks in the text
 * start new lines. Drawing and measuring both use this, so measured heights match drawn output.
 */
function layoutStyledText(doc: PDFKit.PDFDocument, text: string, styleRanges: ParsedMarkdownText['styleRanges'], paint: TextPaint, withEmoji: boolean, options: { width: number; indent?: number; wordSpacing?: number; lineGap?: number }): { lines: StyledLine[]; lineHeight: number } {
  const { fonts, style, fontSize } = paint;
  const lineHeight = selectFace(doc, fonts, style).fontSize(fontSize).currentLineHeight(true) + (options.lineGap ?? 0);
  const segments = withEmoji ? splitTextAndEmoji(text) : [{ type: 'text' as const, content: text }];
  const styleAt = styleCursor(styleRanges);
  const wordSpacing = options.wordSpacing ?? 0;

  const lines: StyledLine[] = [];
  let line: StyledLine = { words: [], width: 0 };
  const endLine = (): void => {
    lines.push(line);
    line = { words: [], width: 0 };
  };
  // A word is placed whole; its parts in different styles stay together on one line
  const place = (parts: StyledWord[]): void => {
    const advance = parts.reduce((sum, part) => sum + part.width, 0) + wordSpacing;
    if (line.words.length > 0 && line.width + advance > options.width - (options.indent ?? 0)) endLine();
    line.words.push(...parts);
    line.width += advance;
  };
  const measure = (type: StyledWord['type'], content: string, range: ParsedMarkdownText['styleRanges'][number] | undefined): StyledWord => {
    let width = type === 'emoji' ? measureEmoji(content, fontSize).width : selectFace(doc, fonts, withMarkdownStyle(style, range)).fontSize(fontSize).widthOfString(content);
    // Fallback when a measurement fails: an emoji is about one em, a character about half
    if (!Number.isFinite(width)) width = type === 'emoji' ? fontSize : fontSize * 0.5 * content.length;
    return { type, content, width, isLink: range?.isLink ?? false, linkUrl: range?.url, bold: range?.bold ?? false, italic: range?.italic ?? false };
  };

  let charPosition = 0;
  for (const segment of segments) {
    const pieces = segment.type === 'emoji' ? [segment.content] : segment.content.split(/(\s+)/).filter((w) => w.length > 0);
    for (const piece of pieces) {
      const breaks = segment.type === 'text' ? (piece.match(/\n/g)?.length ?? 0) : 0;
      if (breaks > 0) {
        charPosition += piece.length;
        for (let i = 0; i < breaks; i++) endLine();
        continue;
      }
      const parts: StyledWord[] = [];
      for (let offset = 0; offset < piece.length; ) {
        const range = styleAt(charPosition + offset);
        const end = segment.type === 'text' && range ? Math.min(piece.length, range.end - charPosition) : piece.length;
        parts.push(measure(segment.type, piece.slice(offset, end), range));
        offset = end;
      }
      charPosition += piece.length;
      place(parts);
    }
  }
  if (line.words.length > 0 || lines.length > 0) endLine();
  selectFace(doc, fonts, style).fontSize(fontSize);
  return { lines, lineHeight };
}

/**
 * Unified text rendering function that handles all cases:
 * - Plain text
 * - Text with markdown links
 * - Text with emoji
 * - Text with both links and emoji
 * - All of the above with wrapping
 *
 * This is the single unified function that replaces renderTextWithEmoji and renderTextWithLinks
 */
function renderTextUnified(doc: PDFKit.PDFDocument, text: string, paint: TextPaint, enableEmoji: boolean, shouldParseMarkdown: boolean, hyperlinkColor: string, options: PDFTextOptions): void {
  const { fonts, style, fontSize } = paint;
  // Detect content features
  const hasEmojiContent = enableEmoji && hasEmoji(text);

  selectFace(doc, fonts, style).fontSize(fontSize);

  // Parse markdown using shared helper
  const { plainText, styleRanges, hasMarkdownContent } = parseMarkdownText(text, shouldParseMarkdown);

  // Plain text case - simple and fast
  if (!hasEmojiContent && !hasMarkdownContent) {
    drawText(doc, plainText, paint, options);
    return;
  }

  // Handle markdown without width - for now require width for markdown
  if (hasMarkdownContent && !hasEmojiContent && options.width === undefined) {
    // For simplicity, require width when using markdown
    throw new Error('width is required for markdown text rendering');
  }

  // Complex case - need wrapping or emoji handling
  const effectiveWidth = options.width;
  if (effectiveWidth === undefined) {
    throw new Error('width is required for complex text rendering (emoji or wrapping)');
  }

  // Style ranges index the markdown-stripped text, so emoji are split out of that same text
  const { lines, lineHeight: layoutLineHeight } = layoutStyledText(doc, hasMarkdownContent ? plainText : text, styleRanges, paint, hasEmojiContent, {
    width: effectiveWidth,
    indent: options.indent,
    wordSpacing: options.wordSpacing,
    lineGap: options.lineGap,
  });

  // Calculate starting position with safety validation
  let startX = options.x ?? doc.x;
  let currentY = options.y ?? doc.y;
  let lineHeight = layoutLineHeight;

  // Safety: validate critical positioning values
  if (Number.isNaN(startX) || !Number.isFinite(startX)) {
    startX = doc.page.margins.left;
  }
  if (Number.isNaN(currentY) || !Number.isFinite(currentY)) {
    currentY = doc.page.margins.top;
  }
  if (Number.isNaN(lineHeight) || !Number.isFinite(lineHeight) || lineHeight <= 0) {
    lineHeight = fontSize * 1.2; // Fallback to standard line height
  }

  // Render each line
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Calculate X offset based on alignment
    let lineX = startX;
    if (options.align === 'center') {
      lineX = startX + (effectiveWidth - line.width) / 2;
    } else if (options.align === 'right') {
      lineX = startX + (effectiveWidth - line.width);
    }

    // Add indent for first line
    if (lineIndex === 0 && options.indent) {
      lineX += options.indent;
    }

    // Merge consecutive text words with same styling for efficient PDF generation
    let wordIndex = 0;
    while (wordIndex < line.words.length) {
      const word = line.words[wordIndex];

      if (word.type === 'emoji') {
        // Render emoji as image
        const emojiBuffer = renderEmojiToBuffer(word.content, fontSize);
        if (emojiBuffer) {
          const emojiMetrics = measureEmoji(word.content, fontSize);
          const emojiY = currentY + emojiMetrics.baselineOffset;
          doc.image(emojiBuffer, lineX, emojiY, {
            width: emojiMetrics.width,
            height: emojiMetrics.height,
          });
        }

        // If emoji is part of a link, add link annotation
        if (word.isLink && word.linkUrl) {
          doc.link(lineX, currentY, word.width, lineHeight, word.linkUrl);
        }

        lineX += word.width + (options.wordSpacing || 0);
        wordIndex++;
      } else {
        // Merge consecutive text words with same styling
        let mergedText = '';
        let mergedWidth = 0;
        const spanStartX = lineX;
        const isLink = word.isLink;
        const isBold = word.bold;
        const isItalic = word.italic;

        // Merge all consecutive text words with same styling
        while (wordIndex < line.words.length && line.words[wordIndex].type === 'text' && line.words[wordIndex].isLink === isLink && line.words[wordIndex].bold === isBold && line.words[wordIndex].italic === isItalic) {
          const currentWord = line.words[wordIndex];
          mergedText += currentWord.content;
          mergedWidth += currentWord.width;
          wordIndex++;
        }

        // Add word spacing to the end (will be applied between words in PDFKit)
        const wordCount = mergedText.split(/\s+/).filter(Boolean).length - 1 || 0;
        const spacingAdjustment = (options.wordSpacing || 0) * wordCount;
        mergedWidth += spacingAdjustment;

        const textOptions: PDFTextOptions = {
          continued: false,
          lineBreak: false,
          underline: isLink || options.underline,
          oblique: options.oblique,
        };
        if (options.strike) {
          textOptions.strike = true;
        }

        // CRITICAL: When using underline with lineBreak: false, PDFKit needs the width
        // to draw the underline. Without it, it calculates NaN coordinates.
        if (textOptions.underline || textOptions.strike) {
          textOptions.width = mergedWidth;
        }

        // Safety: validate coordinates before rendering
        const safeX = Number.isNaN(spanStartX) || !Number.isFinite(spanStartX) ? startX : spanStartX;
        const safeY = Number.isNaN(currentY) || !Number.isFinite(currentY) ? doc.page.margins.top : currentY;

        const spanStyle = withMarkdownStyle(style, { bold: isBold ?? false, italic: isItalic ?? false });
        drawText(doc, mergedText, { ...paint, style: spanStyle, color: isLink ? hyperlinkColor : paint.color }, { ...textOptions, x: safeX, y: safeY });
        selectFace(doc, fonts, style);
        doc.fillColor(paint.color);

        // Add link annotation for the entire span
        if (isLink && word.linkUrl) {
          doc.link(spanStartX, currentY, mergedWidth, lineHeight, word.linkUrl);
        }

        lineX += mergedWidth + (options.wordSpacing || 0);
      }
    }

    // Move to next line using PDFKit's actual line height
    currentY += lineHeight;
  }

  // Update document cursor position
  doc.x = startX;
  doc.y = currentY;

  // Apply moveDown if specified
  if (options.moveDown !== undefined) {
    doc.moveDown(options.moveDown);
  }
}
