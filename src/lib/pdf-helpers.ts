import type PDFKit from 'pdfkit';
import { hasEmoji } from './fonts.ts';
import { layoutText, type TextBlock } from './text-layout.ts';
import type { TextStyle } from './text-style.ts';
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

// Where a `continued` text left off: the next renderText call starts there, on the same line
const continuations = new WeakMap<PDFKit.PDFDocument, { x: number; y: number; offset: number; flowing: boolean }>();

/**
 * Render text with grouped configuration options.
 *
 * Text at the cursor (no `layout.y`) flows: a line that would cross the bottom margin starts a new page. Text at a
 * fixed position stays on its page. Without `layout.width`, text wraps at the right page margin.
 */
/**
 * Lays text out as renderText draws it, from `left` with an extra first-line offset (for continued text).
 */
function layoutForConfig(doc: PDFKit.PDFDocument, text: string, config: TextRenderConfig, left: number, firstLineOffset: number): TextBlock {
  const { typography, color = {}, features = {}, layout = {}, spacing = {}, annotation = {} } = config;
  const { fontSize, fonts, style = {}, underline, strike, oblique } = typography;
  return layoutText(
    doc,
    text,
    { fonts, style, fontSize, color: color.fillColor ?? 'black' },
    {
      width: layout.width ?? doc.page.width - doc.page.margins.right - left,
      align: layout.align ?? 'left',
      indent: (layout.indent ?? 0) + firstLineOffset,
      lineGap: spacing.lineGap ?? 0,
      characterSpacing: spacing.characterSpacing ?? 0,
      wordSpacing: spacing.wordSpacing ?? 0,
      wrap: spacing.lineBreak ?? true,
      markdown: features.markdown ?? false,
      emoji: (features.enableEmoji ?? false) && hasEmoji(text),
      hyperlinkColor: color.hyperlinkColor ?? '#0066CC',
      underline,
      strike,
      oblique,
      link: annotation.link,
    }
  );
}

/**
 * Height and natural width of text exactly as renderText would draw it with the same config.
 */
export function measureText(doc: PDFKit.PDFDocument, text: string, config: TextRenderConfig): { height: number; width: number } {
  const block = layoutForConfig(doc, text, config, config.layout?.x ?? doc.x, 0);
  return { height: block.height + (config.spacing?.paragraphGap ?? 0), width: Math.max(0, ...block.lines.map((line) => line.x + line.width)) };
}

export function renderText(doc: PDFKit.PDFDocument, text: string, config: TextRenderConfig): void {
  const { layout = {}, spacing = {} } = config;
  const { paragraphGap = 0, moveDown, continued = false } = spacing;

  const pending = continuations.get(doc);
  continuations.delete(doc);
  const left = pending?.x ?? layout.x ?? doc.x;
  const flowing = pending ? pending.flowing : layout.y === undefined;
  const block = layoutForConfig(doc, text, config, left, pending?.offset ?? 0);

  const pageBottom = (): number => doc.page.height - doc.page.margins.bottom;
  let base = pending?.y ?? layout.y ?? doc.y;
  let lastTop = base;
  for (const line of block.lines) {
    if (flowing && base + line.top + line.height > pageBottom() && base + line.top > doc.page.margins.top) {
      doc.addPage();
      base = doc.page.margins.top - line.top;
    }
    lastTop = base + line.top;
    if (!line.empty) line.draw(left, lastTop);
  }

  const last = block.lines[block.lines.length - 1];
  if (continued && last) {
    continuations.set(doc, { x: left, y: lastTop, offset: last.x + last.width, flowing });
    doc.x = left;
    doc.y = lastTop;
    return;
  }
  doc.x = left;
  doc.y = base + block.height + paragraphGap;
  if (moveDown !== undefined) doc.moveDown(moveDown);
}

/**
 * Height of text as renderText lays it out at `width`.
 */
export function measureMarkdownTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number, lineGap: number, fonts: FontConfig, parseMarkdown = true, style: TextStyle = {}): number {
  return layoutText(doc, text, { fonts, style, fontSize, color: 'black' }, { width, lineGap, markdown: parseMarkdown }).height;
}
