/**
 * Shared rendering helpers for resume PDF generation.
 * Integrates with emoji support via renderTextWithEmoji.
 */

import type PDFKit from 'pdfkit';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { resolveTextStyle } from './style.ts';
import type { ResolvedTextStyle, TypographyOptions } from './types.ts';

/**
 * Extract paragraphs from content (string or array)
 */
export function paragraphsFromContent(content: string | string[] | undefined): string[] {
  if (Array.isArray(content)) {
    return content
      .flatMap((p) =>
        p
          .split(/\n+/)
          .map((part) => part.trim())
          .filter(Boolean)
      )
      .filter(Boolean);
  }
  const text = (content || '').toString().trim();
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Resolve text styles from typography options
 */
export function resolveStyles(typography: TypographyOptions): ResolvedTextStyle {
  return resolveTextStyle(typography.text, typography.bullet);
}

/**
 * Render paragraphs with emoji support
 */
export function renderParagraphs(doc: PDFKit.PDFDocument, layout: LayoutEngine, paragraphs: string[], style: ResolvedTextStyle, typography: TypographyOptions, emojiAvailable: boolean, align: 'left' | 'center' | 'justify' = 'left'): void {
  doc.fontSize(style.fontSize);
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (!paragraph) continue;
    const height = doc.heightOfString(paragraph, {
      width: layout.getPageWidth(),
      align,
      lineGap: style.lineGap,
    });
    layout.ensureSpace(doc, height);

    renderTextWithEmoji(doc, paragraph, style.fontSize, typography.fonts.regular, emojiAvailable, {
      x: layout.getMargin(),
      y: layout.getCurrentY(),
      width: layout.getPageWidth(),
      align,
      lineGap: style.lineGap,
    });

    layout.advanceY(height);
    if (i !== paragraphs.length - 1) {
      layout.advanceY(style.paragraphMarginBottom);
    }
  }
}

/**
 * Render bullet list with emoji support
 */
export function renderBullets(doc: PDFKit.PDFDocument, layout: LayoutEngine, bullets: string[], style: ResolvedTextStyle, typography: TypographyOptions, emojiAvailable: boolean, indent: number): void {
  doc.fontSize(style.fontSize);
  const bulletWidth = layout.getPageWidth() - indent;

  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i];
    if (!bullet) continue;
    const bulletText = `• ${bullet}`;
    const bulletHeight = doc.heightOfString(bulletText, {
      width: bulletWidth,
      lineGap: style.lineGap,
    });
    layout.ensureSpace(doc, bulletHeight);

    renderTextWithEmoji(doc, bulletText, style.fontSize, typography.fonts.regular, emojiAvailable, {
      x: layout.getMargin() + indent,
      y: layout.getCurrentY(),
      width: bulletWidth,
      lineGap: style.lineGap,
    });

    layout.advanceY(bulletHeight + (i !== bullets.length - 1 ? style.itemMarginBottom : 0));
  }
}

/**
 * Get layout width from document
 */
export function layoutWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/**
 * Ensure a value is a string
 */
export function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}
