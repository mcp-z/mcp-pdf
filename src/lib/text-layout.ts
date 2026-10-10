import LineBreaker from 'linebreak';
import type PDFKit from 'pdfkit';
import { measureEmoji, renderEmojiToBuffer, splitTextAndEmoji } from './emoji-renderer.ts';
import { tokenizeMarkdown, tokensToStyledSegments } from './markdown.ts';
import { drawText, selectFace, type TextPaint, type TextStyle } from './text-style.ts';

/**
 * Text parsed for layout: the characters to draw and the markdown styles over them.
 */
export interface ParsedText {
  plainText: string;
  styleRanges: Array<{ start: number; end: number; bold: boolean; italic: boolean; isLink?: boolean; url?: string }>;
  hasMarkdownContent: boolean;
}

/**
 * Parse markdown text into plain text with style ranges.
 */
export function parseMarkdownText(text: string, parseMarkdown: boolean): ParsedText {
  const styledSegments = parseMarkdown ? tokensToStyledSegments(tokenizeMarkdown(text)) : null;
  const hasMarkdownContent = styledSegments !== null && styledSegments.some((s) => s.bold || s.italic || s.type === 'link');

  if (!hasMarkdownContent) {
    const plainText = styledSegments ? styledSegments.map((s) => s.content).join('') : text;
    return { plainText, styleRanges: [], hasMarkdownContent: false };
  }

  let plainText = '';
  const styleRanges: ParsedText['styleRanges'] = [];
  for (const seg of styledSegments) {
    const start = plainText.length;
    plainText += seg.content;
    styleRanges.push({ start, end: plainText.length, bold: seg.bold, italic: seg.italic, isLink: seg.type === 'link', url: seg.url });
  }
  return { plainText, styleRanges, hasMarkdownContent };
}

type StyleRange = ParsedText['styleRanges'][number];

/**
 * Returns a lookup for the style range covering a character position.
 * Ranges are contiguous and in text order and callers ask in increasing position, so the cursor only moves forward.
 */
function styleCursor(styleRanges: ParsedText['styleRanges']): (position: number) => StyleRange | undefined {
  let index = 0;
  return (position) => {
    let range = styleRanges[index];
    while (range && range.end <= position) range = styleRanges[++index];
    return range && position >= range.start ? range : undefined;
  };
}

/** Combines the base style with a markdown range's bold and italic. */
function withMarkdownStyle(style: TextStyle, range?: { bold: boolean; italic: boolean }): TextStyle {
  return { bold: style.bold || range?.bold, italic: style.italic || range?.italic };
}

export interface TextLayoutOptions {
  width: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  /** First-line indent */
  indent?: number;
  lineGap?: number;
  characterSpacing?: number;
  /** Extra space added to each space character */
  wordSpacing?: number;
  /** False keeps the text on one line (line breaks in the text still apply) */
  wrap?: boolean;
  markdown?: boolean;
  emoji?: boolean;
  hyperlinkColor?: string;
  underline?: boolean;
  strike?: boolean;
  oblique?: boolean | number;
  /** Link for the whole text */
  link?: string;
}

/** A laid-out line: its offset from the top of the block, and how to draw it there */
export interface PlacedLine {
  top: number;
  /** Offset of the line's first glyph from the block's left edge */
  x: number;
  height: number;
  /** Width of the line's content as drawn, after alignment and justification */
  width: number;
  /** A blank line from a paragraph break; nothing to draw */
  empty: boolean;
  draw: (x: number, y: number) => void;
}

export interface TextBlock {
  height: number;
  lines: PlacedLine[];
}

/** A measured piece of a line: a word with its trailing spaces, in one style, or an emoji */
type Word = { type: 'text' | 'emoji'; content: string; width: number; trailing: number; spaces: number; range?: StyleRange };
type Line = { words: Word[]; forced: boolean };

const isSpace = (word: Word): boolean => word.type === 'text' && word.width > 0 && word.width === word.trailing;
const contentWidth = (words: Word[]): number => words.reduce((sum, word) => sum + word.width, 0);
const spaceCount = (text: string): number => text.match(/ /g)?.length ?? 0;

/**
 * Lays text out into lines measured in their own faces. Lines break where PDFKit breaks them (Unicode line breaking,
 * pieces measured with their trailing spaces), line breaks in the text start new lines, whitespace at line edges is
 * dropped, and a word split by styles stays on one line. Measuring and drawing both come from this, so a block's
 * height and the lines it draws always agree.
 */
export function layoutText(doc: PDFKit.PDFDocument, text: string, paint: TextPaint, options: TextLayoutOptions): TextBlock {
  const { fonts, style, fontSize } = paint;
  const { plainText, styleRanges } = parseMarkdownText(text, options.markdown ?? false);
  const characterSpacing = options.characterSpacing ?? 0;
  const wordSpacing = options.wordSpacing ?? 0;
  const lineHeight = selectFace(doc, fonts, style).fontSize(fontSize).currentLineHeight(true) + (options.lineGap ?? 0);
  const styleAt = styleCursor(styleRanges);

  const textWidth = (content: string, range: StyleRange | undefined): number => {
    const width = selectFace(doc, fonts, withMarkdownStyle(style, range)).fontSize(fontSize).widthOfString(content) + characterSpacing * content.length + wordSpacing * spaceCount(content);
    // Fallback when a measurement fails: a character is about half an em
    return Number.isFinite(width) ? width : fontSize * 0.5 * content.length;
  };
  const measure = (type: Word['type'], content: string, range: StyleRange | undefined): Word => {
    if (type === 'emoji') {
      const width = measureEmoji(content, fontSize).width;
      return { type, content, width: Number.isFinite(width) ? width : fontSize, trailing: 0, spaces: 0, range };
    }
    const width = textWidth(content, range);
    const trimmed = content.replace(/\s+$/, '');
    return { type, content, width, trailing: trimmed === content ? 0 : width - (trimmed ? textWidth(trimmed, range) : 0), spaces: spaceCount(content), range };
  };
  // Measure a run of text, split where styles change and into words with their trailing spaces
  const measureRun = (run: string, start: number): Word[] => {
    const words: Word[] = [];
    let offset = 0;
    for (const segment of options.emoji ? splitTextAndEmoji(run) : [{ type: 'text' as const, content: run }]) {
      for (let at = 0; at < segment.content.length; ) {
        const range = styleAt(start + offset + at);
        const end = segment.type === 'text' && range ? Math.min(segment.content.length, range.end - start - offset) : segment.content.length;
        const content = segment.content.slice(at, end);
        for (const part of segment.type === 'text' ? (content.match(/\S+\s*|\s+/g) ?? []) : [content]) words.push(measure(segment.type, part, range));
        at = end;
      }
      offset += segment.content.length;
    }
    return words;
  };

  // Wrap at Unicode break opportunities (UAX #14), as PDFKit does: a piece fits when its width, including its
  // trailing spaces, fits the space left; a piece wider than a whole line is split between characters.
  const lines: Line[] = [];
  let current: Line = { words: [], forced: false };
  let currentWidth = 0;
  const endLine = (forced: boolean): void => {
    lines.push({ ...current, forced });
    current = { words: [], forced: false };
    currentWidth = 0;
  };
  const available = (): number => options.width - (lines.length === 0 ? (options.indent ?? 0) : 0);
  const fits = (width: number): boolean => options.wrap === false || currentWidth + width <= available() + 1e-9;
  const place = (words: Word[]): void => {
    current.words.push(...words);
    currentWidth += contentWidth(words);
  };

  const breaker = new LineBreaker(plainText);
  let pieceStart = 0;
  for (let bk = breaker.nextBreak(); bk; bk = breaker.nextBreak()) {
    let piece = plainText.slice(pieceStart, bk.position).replace(/\r?\n$/, '');
    let start = pieceStart;
    pieceStart = bk.position;
    let words = measureRun(piece, start);
    if (!fits(contentWidth(words)) && current.words.length > 0) endLine(false);
    // Too wide for any line: place as many characters as fit, line by line
    while (options.wrap !== false && contentWidth(words) - (words[words.length - 1]?.trailing ?? 0) > available() + 1e-9) {
      const characters = Array.from(piece);
      let count = 1;
      while (count < characters.length && fits(contentWidth(measureRun(characters.slice(0, count + 1).join(''), start)))) count++;
      const head = characters.slice(0, count).join('');
      place(measureRun(head, start));
      endLine(false);
      piece = piece.slice(head.length);
      start += head.length;
      words = measureRun(piece, start);
    }
    place(words);
    if (bk.required) endLine(true);
  }
  if (current.words.length > 0 || lines.length === 0) endLine(false);

  // Trim whitespace at line edges, then place
  const placed: PlacedLine[] = lines.map((line, index) => {
    const words = [...line.words];
    while (words[0] && isSpace(words[0])) words.shift();
    while (words.length > 0 && isSpace(words[words.length - 1] as Word)) words.pop();
    const lastWord = words[words.length - 1];
    if (lastWord?.trailing) {
      const content = lastWord.content.replace(/\s+$/, '');
      words[words.length - 1] = { ...lastWord, content, width: lastWord.width - lastWord.trailing, trailing: 0, spaces: spaceCount(content) };
    }
    const indent = index === 0 ? (options.indent ?? 0) : 0;
    const natural = contentWidth(words);
    const lastOfParagraph = line.forced || index === lines.length - 1;
    const spaces = words.reduce((sum, word) => sum + word.spaces, 0);
    const justify = options.align === 'justify' && !lastOfParagraph && spaces > 0;
    const extraPerSpace = justify ? (options.width - indent - natural) / spaces : 0;
    const width = justify ? options.width - indent : natural;
    const offset = indent + (options.align === 'center' ? (options.width - indent - width) / 2 : options.align === 'right' ? options.width - indent - width : 0);
    return {
      top: index * lineHeight,
      x: offset,
      height: lineHeight,
      width,
      empty: words.length === 0,
      draw: (x: number, y: number) => drawLine(doc, words, paint, options, { x: x + offset, y, lineHeight, extraPerSpace }),
    };
  });
  selectFace(doc, fonts, style).fontSize(fontSize);
  return { height: placed.length * lineHeight, lines: placed };
}

/**
 * Draws one line: consecutive words in the same style are drawn as one span; emoji are drawn as images.
 */
function drawLine(doc: PDFKit.PDFDocument, words: Word[], paint: TextPaint, options: TextLayoutOptions, at: { x: number; y: number; lineHeight: number; extraPerSpace: number }): void {
  const { fonts, style, fontSize } = paint;
  let x = at.x;
  let index = 0;
  while (index < words.length) {
    const word = words[index] as Word;
    if (word.type === 'emoji') {
      const image = renderEmojiToBuffer(word.content, fontSize);
      if (image) {
        const metrics = measureEmoji(word.content, fontSize);
        doc.image(image, x, at.y + metrics.baselineOffset, { width: metrics.width, height: metrics.height });
      }
      const url = word.range?.isLink ? word.range.url : options.link;
      if (url) doc.link(x, at.y, word.width, at.lineHeight, url);
      x += word.width;
      index++;
      continue;
    }

    const range = word.range;
    let spanText = '';
    let spanWidth = 0;
    let spanSpaces = 0;
    while (index < words.length) {
      const next = words[index] as Word;
      if (next.type !== 'text' || next.range?.isLink !== range?.isLink || next.range?.url !== range?.url || next.range?.bold !== range?.bold || next.range?.italic !== range?.italic) break;
      spanText += next.content;
      spanWidth += next.width;
      spanSpaces += next.spaces;
      index++;
    }
    // Measured widths already include wordSpacing; justification widens each space further
    spanWidth += spanSpaces * at.extraPerSpace;

    const isLink = range?.isLink === true;
    const url = isLink ? range?.url : options.link;
    drawText(
      doc,
      spanText,
      { ...paint, style: withMarkdownStyle(style, range), color: isLink ? (options.hyperlinkColor ?? '#0066CC') : paint.color },
      {
        x,
        y: at.y,
        lineBreak: false,
        characterSpacing: options.characterSpacing,
        wordSpacing: (options.wordSpacing ?? 0) + at.extraPerSpace || undefined,
        underline: isLink || options.underline,
        strike: options.strike,
        oblique: options.oblique,
        // PDFKit needs the span width to draw underline and strike without wrapping
        ...((isLink || options.underline || options.strike) && { width: spanWidth }),
        ...(url && { link: url }),
      }
    );
    x += spanWidth;
  }
  selectFace(doc, fonts, style).fontSize(fontSize);
  doc.fillColor(paint.color);
}
