import type PDFKit from 'pdfkit';
import { renderEmojiToBuffer, splitTextAndEmoji } from './emoji-renderer.ts';
import { hasEmoji } from './fonts.ts';

/**
 * Render text with inline emoji support
 *
 * If emoji font is available and text contains emoji, renders emoji as inline images.
 * Otherwise, renders text normally using PDFKit.
 *
 * Supports both single-line and multi-line/wrapped text with emoji.
 *
 * @param doc - PDFKit document
 * @param text - Text to render (may contain emoji)
 * @param fontSize - Font size in points
 * @param fontName - Font name to use for text
 * @param emojiAvailable - Whether emoji font is available
 * @param options - Additional PDFKit text options
 */
export function renderTextWithEmoji(doc: PDFKit.PDFDocument, text: string, fontSize: number, fontName: string, emojiAvailable: boolean, options: any = {}): void {
  if (!emojiAvailable || !hasEmoji(text)) {
    // No emoji support or no emoji in text - render normally
    doc.fontSize(fontSize).font(fontName);

    // PDFKit requires three-argument form for proper positioning with width
    if (options.x !== undefined || options.y !== undefined) {
      const x = options.x;
      const y = options.y;
      const textOptions = { ...options };
      delete textOptions.x;
      delete textOptions.y;
      doc.text(text, x, y, textOptions);
    } else {
      doc.text(text, options);
    }
    return;
  }

  // Setup font for measurements
  doc.fontSize(fontSize).font(fontName);

  // Determine starting position
  const startX = options.x !== undefined ? options.x : doc.x;
  const startY = options.y !== undefined ? options.y : doc.y;

  // Calculate available width
  const availableWidth = options.width || doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const effectiveWidth = availableWidth - (options.indent || 0);

  // Split text into text/emoji segments
  const segments = splitTextAndEmoji(text);

  // Break segments into words for wrapping
  const words: Array<{ type: 'text' | 'emoji'; content: string; width: number }> = [];
  for (const segment of segments) {
    if (segment.type === 'emoji') {
      words.push({
        type: 'emoji',
        content: segment.content,
        width: fontSize * 1.1, // Emoji width with spacing
      });
    } else {
      // Split text segment into words
      const textWords = segment.content.split(/(\s+)/);
      for (const word of textWords) {
        if (word.length > 0) {
          words.push({
            type: 'text',
            content: word,
            width: doc.widthOfString(word),
          });
        }
      }
    }
  }

  // Wrap words into lines
  const lines: Array<Array<{ type: 'text' | 'emoji'; content: string; width: number }>> = [];
  let currentLine: Array<{ type: 'text' | 'emoji'; content: string; width: number }> = [];
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = word.width;

    // Check if adding this word would exceed the line width
    if (currentLineWidth + wordWidth > effectiveWidth && currentLine.length > 0) {
      // Start a new line
      lines.push(currentLine);
      currentLine = [word];
      currentLineWidth = wordWidth;
    } else {
      // Add to current line
      currentLine.push(word);
      currentLineWidth += wordWidth;
    }
  }

  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Calculate line height
  const lineHeight = fontSize * (options.lineGap !== undefined ? 1 + options.lineGap / fontSize : 1.15);

  // Render each line
  let currentY = startY;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    let currentX = startX;

    // Apply indent to first line if specified
    if (lineIndex === 0 && options.indent) {
      currentX += options.indent;
    }

    // Handle alignment
    if (options.align === 'center' || options.align === 'right') {
      const lineWidth = line.reduce((sum, word) => sum + word.width, 0);
      if (options.align === 'center') {
        currentX += (effectiveWidth - lineWidth) / 2;
      } else if (options.align === 'right') {
        currentX += effectiveWidth - lineWidth;
      }
    }

    // Render each word in the line
    for (let i = 0; i < line.length; i++) {
      const word = line[i];
      if (!word) continue;

      if (word.type === 'text') {
        // Render text
        doc.text(word.content, currentX, currentY, {
          continued: false,
          lineBreak: false,
        });
        currentX += word.width;
      } else {
        // Render emoji as inline image
        const emojiBuffer = renderEmojiToBuffer(word.content, fontSize);
        if (emojiBuffer) {
          // Position emoji slightly above baseline to center it
          const emojiY = currentY - fontSize * 0.1;
          doc.image(emojiBuffer, currentX, emojiY, {
            width: fontSize,
            height: fontSize,
          });
        }
        currentX += word.width;
      }
    }

    // Move to next line
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
