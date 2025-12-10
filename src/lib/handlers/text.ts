/**
 * Text element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FieldTemplates, TextElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { paragraphsFromContent, renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderTextHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: TextElement, typography: TypographyOptions, _fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const paragraphs = paragraphsFromContent(element.content);
  if (!paragraphs.length) return;

  const style = resolveStyles(typography);

  // Apply style overrides
  const fontKey = element.style?.font ?? 'regular';
  const font = typography.fonts[fontKey] ?? typography.fonts.regular;
  const align = element.style?.alignment ?? 'justify';

  doc.font(font).fillColor('#000000');
  renderParagraphs(doc, layout, paragraphs, style, typography, emojiAvailable, align);

  // Add trailing spacing for section separation
  layout.advanceY(style.blockMarginBottom);
}
