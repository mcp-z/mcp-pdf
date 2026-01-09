import type PDFKit from 'pdfkit';
import { measureEmoji, renderEmojiToBuffer, splitTextAndEmoji } from './emoji-renderer.ts';
import { hasEmoji } from './fonts.ts';

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
  bold?: boolean;
  underline?: boolean;
  strike?: boolean;
  oblique?: boolean | number;
}

export interface ColorConfig {
  fillColor?: string;
  hyperlinkColor?: string;
}

export interface MarkdownConfig {
  parseLinks?: boolean;
  parseBold?: boolean;
  parseItalic?: boolean;
}

export interface FeaturesConfig {
  enableEmoji?: boolean;
  markdown?: MarkdownConfig;
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
function hasMarkdownLinks(text: string): boolean {
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

  const { fontSize, fontName } = typography;
  const { hyperlinkColor = '#0066CC' } = color;
  const { enableEmoji = false, markdown: markdownConfig = {} } = features;
  const { parseLinks = false } = markdownConfig;
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

  renderTextUnified(doc, text, fontSize, fontName, enableEmoji, parseLinks, hyperlinkColor, options);
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
function renderTextUnified(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, enableEmoji: boolean, parseMarkdownLinks: boolean, hyperlinkColor: string, options: PDFTextOptions): void {
  // Detect content features
  const hasLinks = parseMarkdownLinks && hasMarkdownLinks(text);
  const hasEmojiContent = enableEmoji && hasEmoji(text);

  // Apply typography settings
  doc.fontSize(fontSize).font(fontName);

  // Plain text case - simple and fast
  if (!hasEmojiContent && !hasLinks) {
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
  const markdownSegments = hasLinks ? _parseMarkdownLinks(text) : null;
  const emojiSegments = hasEmojiContent ? splitTextAndEmoji(text) : null;

  // Handle links without width - simple case
  if (hasLinks && !hasEmojiContent && options.width === undefined) {
    if (markdownSegments) {
      renderTextWithLinksSimple(doc, markdownSegments, fontName, hyperlinkColor, options.x, options.y, fontSize);
    }
    return;
  }

  // Complex case - need wrapping or emoji handling
  const effectiveWidth = options.width;
  if (effectiveWidth === undefined) {
    throw new Error('width is required for complex text rendering (emoji or wrapping)');
  }

  // Prepare text for rendering
  let textToRender = text;
  const linkAnnotations: Array<{ text: string; url: string; startIndex: number }> = [];

  if (hasLinks) {
    if (hasLinks && markdownSegments) {
      // Build plain text and track link positions
      let plainText = '';
      for (const segment of markdownSegments) {
        if (segment.type === 'text') {
          plainText += segment.content;
        } else {
          // Track where this link appears in the plain text
          linkAnnotations.push({
            text: segment.text,
            url: segment.url,
            startIndex: plainText.length,
          });
          plainText += segment.text;
        }
      }
      textToRender = plainText;
    }
  }

  // Split into segments for rendering
  const segments = hasEmojiContent && emojiSegments ? emojiSegments : [{ type: 'text' as const, content: textToRender }];

  // Calculate word positions and wrap
  const words: Array<{ type: 'text' | 'emoji'; content: string; width: number; charStart: number; charEnd: number; isLink?: boolean; linkUrl?: string }> = [];
  let charPosition = 0;

  for (const segment of segments) {
    if (segment.type === 'emoji') {
      const emojiMetrics = measureEmoji(segment.content, fontSize);
      const charEnd = charPosition + segment.content.length;

      // Check if this emoji is part of a link
      const linkInfo = linkAnnotations.find((link) => charPosition >= link.startIndex && charPosition < link.startIndex + link.text.length);

      words.push({
        type: 'emoji',
        content: segment.content,
        width: emojiMetrics.width,
        charStart: charPosition,
        charEnd,
        isLink: !!linkInfo,
        linkUrl: linkInfo?.url,
      });
      charPosition = charEnd;
    } else {
      // Split text segment into words
      const textWords = segment.content.split(/(\s+)/);
      for (const word of textWords) {
        if (word.length > 0) {
          const charEnd = charPosition + word.length;

          // Check if this word is part of a link
          const linkInfo = linkAnnotations.find((link) => charPosition >= link.startIndex && charPosition < link.startIndex + link.text.length);

          words.push({
            type: 'text',
            content: word,
            width: doc.widthOfString(word),
            charStart: charPosition,
            charEnd,
            isLink: !!linkInfo,
            linkUrl: linkInfo?.url,
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

  // Calculate starting position
  const startX = options.x ?? doc.x;
  let currentY = options.y ?? doc.y;
  const lineGap = options.lineGap ?? 0;
  const lineHeight = doc.currentLineHeight(true) + lineGap;

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

        // Merge all consecutive text words with same link status
        while (wordIndex < line.words.length && line.words[wordIndex].type === 'text' && line.words[wordIndex].isLink === isLink) {
          mergedText += line.words[wordIndex].content;
          mergedWidth += line.words[wordIndex].width;
          wordIndex++;
        }

        // Add word spacing to the end (will be applied between words in PDFKit)
        mergedWidth += (options.wordSpacing || 0) * (mergedText.split(/\s+/).filter(Boolean).length - 1 || 0);

        // Set color for this span
        if (isLink) {
          doc.fillColor(hyperlinkColor);
        } else {
          doc.fillColor('black');
        }

        // Render merged text span
        const textOptions: PDFTextOptions = {
          continued: false,
          lineBreak: true,
          underline: isLink || options.underline,
        };
        if (options.strike) {
          textOptions.strike = true;
        }

        doc.text(mergedText, spanStartX, currentY, textOptions);

        // Reset color to black
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
function renderTextWithLinksSimple(doc: PDFKit.PDFDocument, segments: MarkdownSegment[], fontName: string, hyperlinkColor: string, x?: number, y?: number, _fontSize?: number): void {
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
