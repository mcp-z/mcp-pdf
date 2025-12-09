/**
 * Summary-highlights element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, SummaryHighlightsElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { paragraphsFromContent, renderBullets, renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderSummaryHighlightsHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: SummaryHighlightsElement, typography: TypographyOptions, _formatting: FormattingOptions, emojiAvailable: boolean): void {
  const style = resolveStyles(typography);
  const { bullet } = typography;

  // Render summary paragraphs
  if (element.summary) {
    const paragraphs = paragraphsFromContent(element.summary);
    if (paragraphs.length) {
      const fontKey = element.style?.font ?? 'regular';
      const font = typography.fonts[fontKey] ?? typography.fonts.regular;
      doc.font(font).fillColor('#000000');
      renderParagraphs(doc, layout, paragraphs, style, typography, emojiAvailable, 'justify');
    }
  }

  // Render highlights as bullets
  if (element.highlights.length) {
    if (element.summary) {
      layout.advanceY(style.blockMarginBottom);
    }
    doc.font(typography.fonts.regular).fillColor('#000000');
    renderBullets(doc, layout, element.highlights, style, typography, emojiAvailable, bullet.indent);
  }

  // Add trailing spacing
  layout.advanceY(style.blockMarginBottom);
}
