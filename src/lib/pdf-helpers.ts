import type PDFKit from 'pdfkit';
import { measureEmoji, renderEmojiToBuffer, splitTextAndEmoji } from './emoji-renderer.ts';
import { hasEmoji } from './fonts.ts';
import { tokenizeMarkdown, tokensToStyledSegments } from './markdown.ts';
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
  fontName: string;
  fonts?: FontConfig;
  bold?: boolean;
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
 * Segment types for text with markdown links
 */
interface TextSegment {
  type: 'text';
  content: string;
}

interface LinkSegment {
  type: 'link';
  text: string;
  url: string;
}

type MarkdownSegment = TextSegment | LinkSegment;

/**
 * Parse markdown links from text and return segments
 * Converts [text](url) into segments with link metadata
 */
function _parseMarkdownLinks(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = linkRegex.exec(text);

  while (match !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add the link
    segments.push({
      type: 'link',
      text: match[1],
      url: match[2],
    });

    lastIndex = match.index + match[0].length;
    match = linkRegex.exec(text);
  }

  // Add remaining text after the last link
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  // If no links were found, return the original text as a single segment
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text,
    });
  }

  return segments;
}

/**
 * Check if text contains markdown links
 */
function _hasMarkdownLinks(text: string): boolean {
  return /\[([^\]]+)\]\(([^)]+)\)/.test(text);
}

/**
 * Render text with inline emoji support and markdown links
 *
 * If emoji font is available and text contains emoji, renders emoji as inline images.
 * If text contains markdown links [text](url), renders them as clickable links.
 * Otherwise, renders text normally using PDFKit.
 *
 * Supports both single-line and multi-line/wrapped text with emoji and links.
 *
 * @param doc - PDFKit document
 * @param text - Text to render (may contain emoji and markdown links)
 * @param fontSize - Font size in points
 * @param fontName - Font name to use for text
 * @param emojiAvailable - Whether emoji font is available
 * @param enableMarkdownLinks - Whether to parse and render markdown links as clickable
 * @param hyperlinkColor - Color for hyperlink text (default: #0066CC)
 * @param options - Additional PDFKit text options
 */

/**
 * Render text with grouped configuration options.
 * New API that groups related options together for better organization.
 */
export function renderText(doc: PDFKit.PDFDocument, text: string, config: TextRenderConfig): void {
  const { typography, color = {}, features = {}, layout = {}, spacing = {}, annotation = {} } = config;

  const { fontSize, fontName, fonts } = typography;
  const { hyperlinkColor = '#0066CC' } = color;
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
  };

  renderTextUnified(doc, text, fontSize, fontName, fonts ?? null, enableEmoji, shouldParseMarkdown, hyperlinkColor, options);
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
export function measureMarkdownTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number, lineGap: number, fonts: FontConfig, parseMarkdown = true): number {
  // Set base font for measurement
  doc.font(fonts.regular).fontSize(fontSize);

  // Parse markdown using shared helper
  const { plainText, styleRanges, hasMarkdownContent } = parseMarkdownText(text, parseMarkdown);

  // Plain text case - use simple heightOfString
  if (!hasMarkdownContent) {
    return doc.heightOfString(plainText, { width, lineGap });
  }

  // Complex case - calculate with proper font widths for each segment
  const words: Array<{ width: number }> = [];
  const textWords = plainText.split(/(\s+)/);
  let charPosition = 0;

  for (const word of textWords) {
    if (word.length > 0) {
      const charEnd = charPosition + word.length;
      const styleInfo = styleRanges.find((range) => charPosition >= range.start && charPosition < range.end);
      const isBold = styleInfo?.bold ?? false;
      const isItalic = styleInfo?.italic ?? false;

      // Measure with correct font
      const resolved = resolveFontForStyle(fonts, isBold, isItalic);
      doc.font(resolved.fontName).fontSize(fontSize);
      const wordWidth = doc.widthOfString(word);

      words.push({ width: wordWidth });
      charPosition = charEnd;
    }
  }

  // Wrap words into lines
  let lineCount = 0;
  let currentLineWidth = 0;

  for (const word of words) {
    if (currentLineWidth === 0) {
      currentLineWidth = word.width;
      lineCount = 1;
    } else if (currentLineWidth + word.width <= width) {
      currentLineWidth += word.width;
    } else {
      lineCount++;
      currentLineWidth = word.width;
    }
  }

  // Ensure at least one line for non-empty text
  if (lineCount === 0 && plainText.length > 0) {
    lineCount = 1;
  }

  // Calculate total height
  const lineHeight = fontSize + lineGap;
  return lineCount * lineHeight;
}

/**
 * Resolve font name based on bold/italic flags
 */
function resolveFontForStyle(fonts: FontConfig, bold: boolean, italic: boolean): { fontName: string; applyOblique: boolean } {
  if (bold && italic) {
    if (fonts.boldItalic) {
      return { fontName: fonts.boldItalic, applyOblique: false };
    }
    // Fallback: bold + PDFKit oblique
    return { fontName: fonts.bold, applyOblique: true };
  }
  if (bold) {
    return { fontName: fonts.bold, applyOblique: false };
  }
  if (italic) {
    return { fontName: fonts.italic, applyOblique: false };
  }
  return { fontName: fonts.regular, applyOblique: false };
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
function renderTextUnified(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, fonts: FontConfig | null, enableEmoji: boolean, shouldParseMarkdown: boolean, hyperlinkColor: string, options: PDFTextOptions): void {
  // Detect content features
  const hasEmojiContent = enableEmoji && hasEmoji(text);

  // Apply typography settings
  doc.fontSize(fontSize).font(fontName);

  // Parse markdown using shared helper
  const { plainText, styleRanges, hasMarkdownContent } = parseMarkdownText(text, shouldParseMarkdown);

  // Plain text case - simple and fast
  if (!hasEmojiContent && !hasMarkdownContent) {
    if (options.x !== undefined || options.y !== undefined) {
      const textOptions = { ...options };
      delete textOptions.x;
      delete textOptions.y;
      doc.text(text, options.x, options.y, textOptions);
    } else {
      doc.text(text, options);
    }
    return;
  }

  // Parse content
  const emojiSegments = hasEmojiContent ? splitTextAndEmoji(text) : null;

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

  // Use parsed markdown results
  const textToRender = hasMarkdownContent ? plainText : text;

  // Split into segments for rendering
  const segments = hasEmojiContent && emojiSegments ? emojiSegments : [{ type: 'text' as const, content: textToRender }];

  // Calculate word positions and wrap
  const words: Array<{ type: 'text' | 'emoji'; content: string; width: number; charStart: number; charEnd: number; isLink?: boolean; linkUrl?: string; bold?: boolean; italic?: boolean }> = [];
  let charPosition = 0;

  for (const segment of segments) {
    if (segment.type === 'emoji') {
      const emojiMetrics = measureEmoji(segment.content, fontSize);
      const charEnd = charPosition + segment.content.length;

      // Check styling for this emoji
      const styleInfo = styleRanges.find((range) => charPosition >= range.start && charPosition < range.end);

      // Safety: validate width to prevent layout issues if emoji measurement fails
      const emojiWidth = Number.isNaN(emojiMetrics.width) || !Number.isFinite(emojiMetrics.width) ? fontSize : emojiMetrics.width;

      words.push({
        type: 'emoji',
        content: segment.content,
        width: emojiWidth,
        charStart: charPosition,
        charEnd,
        isLink: styleInfo?.isLink ?? false,
        linkUrl: styleInfo?.url,
        bold: styleInfo?.bold ?? false,
        italic: styleInfo?.italic ?? false,
      });
      charPosition = charEnd;
    } else {
      // Split text segment into words
      const textWords = segment.content.split(/(\s+)/);
      for (const word of textWords) {
        if (word.length > 0) {
          const charEnd = charPosition + word.length;

          // Check styling for this word
          const styleInfo = styleRanges.find((range) => charPosition >= range.start && charPosition < range.end);
          const isBold = styleInfo?.bold ?? false;
          const isItalic = styleInfo?.italic ?? false;

          // Calculate width with the correct font
          let wordWidth: number;
          if (fonts && (isBold || isItalic)) {
            const resolved = resolveFontForStyle(fonts, isBold, isItalic);
            doc.font(resolved.fontName);
            wordWidth = doc.widthOfString(word);
            doc.font(fontName); // Restore to base font
          } else {
            wordWidth = doc.widthOfString(word);
          }

          // Safety: validate width to prevent layout issues if font measurement fails
          if (Number.isNaN(wordWidth) || !Number.isFinite(wordWidth)) {
            // Fallback: estimate based on fontSize (average char width ~0.5 * fontSize)
            wordWidth = fontSize * 0.5 * word.length;
          }

          words.push({
            type: 'text',
            content: word,
            width: wordWidth,
            charStart: charPosition,
            charEnd,
            isLink: styleInfo?.isLink ?? false,
            linkUrl: styleInfo?.url,
            bold: isBold,
            italic: isItalic,
          });
          charPosition = charEnd;
        }
      }
    }
  }

  // Wrap words into lines
  const lines: Array<{ words: typeof words; width: number }> = [];
  let currentLineWords: typeof words = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = word.width + (options.wordSpacing || 0);

    if (currentLineWords.length === 0) {
      currentLineWords.push(word);
      currentLineWidth = wordWidth;
    } else if (currentLineWidth + wordWidth <= effectiveWidth - (options.indent || 0)) {
      currentLineWords.push(word);
      currentLineWidth += wordWidth;
    } else {
      lines.push({ words: currentLineWords, width: currentLineWidth });
      currentLineWords = [word];
      currentLineWidth = wordWidth;
    }
  }

  if (currentLineWords.length > 0) {
    lines.push({ words: currentLineWords, width: currentLineWidth });
  }

  // Calculate starting position with safety validation
  let startX = options.x ?? doc.x;
  let currentY = options.y ?? doc.y;
  const lineGap = options.lineGap ?? 0;
  let lineHeight = doc.currentLineHeight(true) + lineGap;

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

        // Determine font for this span
        let spanFontName = fontName;
        let applyOblique = false;

        if (fonts && (isBold || isItalic)) {
          const resolved = resolveFontForStyle(fonts, isBold ?? false, isItalic ?? false);
          spanFontName = resolved.fontName;
          applyOblique = resolved.applyOblique;
        }

        // Set color for this span
        if (isLink) {
          doc.fillColor(hyperlinkColor);
        } else {
          doc.fillColor('black');
        }

        // Apply font
        doc.font(spanFontName);

        // Render merged text span
        const textOptions: PDFTextOptions = {
          continued: false,
          lineBreak: false,
          underline: isLink || options.underline,
          oblique: applyOblique || undefined,
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

        doc.text(mergedText, safeX, safeY, textOptions);

        // Reset to base font and color
        doc.font(fontName);
        doc.fillColor('black');

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

/**
 * Simple path for rendering links without width constraint
 */
function _renderTextWithLinksSimple(doc: PDFKit.PDFDocument, segments: MarkdownSegment[], fontName: string, hyperlinkColor: string, x?: number, y?: number, _fontSize?: number): void {
  doc.font(fontName);

  const startX = x ?? doc.x;
  const startY = y ?? doc.y;
  let currentX = startX;
  const currentY = startY;

  for (const segment of segments) {
    if (segment.type === 'text') {
      doc.text(segment.content, currentX, currentY, { continued: true, lineBreak: false });
      currentX += doc.widthOfString(segment.content);
    } else {
      // Render link text with blue color (PDFKit's underline will use fillColor)
      const linkText = segment.text;
      const linkWidth = doc.widthOfString(linkText);
      const currentLineHeight = doc.currentLineHeight(true);

      // Set fillColor to hyperlink color - PDFKit's underline will use this color
      doc.fillColor(hyperlinkColor);
      doc.text(linkText, currentX, currentY, {
        continued: true,
        lineBreak: false,
        underline: true,
      });
      doc.fillColor('black');

      // Add clickable link annotation
      doc.link(currentX, currentY, linkWidth, currentLineHeight, segment.url);
      currentX += linkWidth;
    }
  }

  doc.text('', { continued: false }); // End the continued text
}
